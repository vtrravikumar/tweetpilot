import { describe, expect, it, vi } from "vitest";
import { CartoonImageError } from "../src/cartoon/errors";
import { OpenAIImageProvider, OPENAI_IMAGE_EDITS_URL } from "../src/cartoon/openaiImageProvider";
import type { GenerateCartoonInput } from "../src/cartoon/types";

const input: GenerateCartoonInput = {
  thought: "A politician promises a paperless office from a room full of files.",
  characterReference: {
    version: "ravi-editorial-v1",
    bytes: new Uint8Array([137, 80, 78, 71]),
    mimeType: "image/png",
  },
  operationId: "test-operation-1",
  safetyIdentifier: "sha256:opaque-test-id",
};

const pngBase64 = "iVBORw=="; // decoded test bytes: 0x89 0x50 0x8f

describe("OpenAIImageProvider", () => {
  it("posts one image edit with server-provided reference and returns decoded image bytes", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(url);
      requestInit = init;
      return Response.json({ data: [{ b64_json: pngBase64 }] });
    });
    const provider = new OpenAIImageProvider({
      apiKey: "image-secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await provider.generate(input);

    expect(requestUrl).toBe(OPENAI_IMAGE_EDITS_URL);
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Authorization")).toBe("Bearer image-secret");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = requestInit?.body as FormData;
    expect(body.get("model")).toBe("gpt-image-2");
    expect(body.get("size")).toBe("1024x1024");
    expect(body.get("quality")).toBe("medium");
    expect(body.get("n")).toBe("1");
    expect(body.get("safety_identifier")).toBe(input.safetyIdentifier);
    expect(body.get("prompt")).toContain(input.thought);
    expect(body.get("prompt")).toContain("no fade at the sides");
    expect(body.get("image")).toBeInstanceOf(Blob);
    expect(result.bytes).toEqual(new Uint8Array([137, 80, 143]));
    expect(result.mimeType).toBe("image/png");
    expect(result.model).toBe("gpt-image-2");
    expect(result.characterReferenceVersion).toBe("ravi-editorial-v1");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("fails closed when the image key is missing without making a request", async () => {
    const fetchImpl = vi.fn();
    const provider = new OpenAIImageProvider({ apiKey: "  ", fetchImpl: fetchImpl as typeof fetch });
    await expect(provider.generate(input)).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not retry upstream errors and does not expose provider response text", async () => {
    const fetchImpl = vi.fn(async () => new Response("private provider detail", { status: 429 }));
    const provider = new OpenAIImageProvider({ apiKey: "image-secret", fetchImpl: fetchImpl as typeof fetch });
    let caught: unknown;
    try {
      await provider.generate(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CartoonImageError);
    expect(caught).toMatchObject({ kind: "upstream_error", upstreamStatus: 429 });
    expect((caught as Error).message).not.toContain("private provider detail");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("classifies a timeout as an uncertain provider outcome and does not retry", async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    );
    const provider = new OpenAIImageProvider({
      apiKey: "image-secret",
      timeoutMs: 5,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(provider.generate(input)).rejects.toMatchObject({ kind: "upstream_timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed or empty provider image data", async () => {
    const malformed = new OpenAIImageProvider({
      apiKey: "image-secret",
      fetchImpl: (async () => Response.json({ data: [{ b64_json: "not base64!" }] })) as typeof fetch,
    });
    await expect(malformed.generate(input)).rejects.toMatchObject({ kind: "invalid_response" });

    const empty = new OpenAIImageProvider({
      apiKey: "image-secret",
      fetchImpl: (async () => Response.json({ data: [] })) as typeof fetch,
    });
    await expect(empty.generate(input)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("validates the thought, reference, and privacy-preserving identifier before networking", async () => {
    const fetchImpl = vi.fn();
    const provider = new OpenAIImageProvider({ apiKey: "image-secret", fetchImpl: fetchImpl as typeof fetch });
    await expect(provider.generate({ ...input, thought: "  " })).rejects.toMatchObject({ kind: "invalid_input" });
    await expect(provider.generate({ ...input, safetyIdentifier: "" })).rejects.toMatchObject({ kind: "invalid_input" });
    await expect(provider.generate({
      ...input,
      characterReference: { ...input.characterReference, bytes: new Uint8Array() },
    })).rejects.toMatchObject({ kind: "invalid_input" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
