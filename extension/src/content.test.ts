import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  composerHost,
  composerText,
  copyTextToClipboard,
  findComposer,
  replaceComposerText
} from "./dom";
import { resolveTopic } from "./topic";

describe("topic resolution", () => {
  it("keeps an explicit topic", () => {
    expect(resolveTopic("Photography")).toBe("Photography");
  });

  it("resolves Surprise me to a real topic", () => {
    expect(resolveTopic("Surprise me")).not.toBe("Surprise me");
  });

  it("keeps a custom topic supplied by the user", () => {
    expect(resolveTopic("Vintage cameras")).toBe("Vintage cameras");
  });

  it("avoids the previous topic when choosing Surprise me", () => {
    const previous = "Photography";
    for (let index = 0; index < 20; index += 1) {
      expect(resolveTopic("Surprise me", previous)).not.toBe(previous);
    }
  });
});

describe("X composer detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds a visible X tweet textarea", () => {
    const composer = document.createElement("div");
    composer.setAttribute("data-testid", "tweetTextarea_0");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    composer.textContent = "Hello";
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    expect(findComposer()).toBe(composer);
    expect(composerText(composer)).toBe("Hello");
  });

  it("reads only the native X editor when Vichar UI is mounted in the composer host", () => {
    const host = document.createElement("div");
    const composer = document.createElement("div");
    composer.setAttribute("data-testid", "tweetTextarea_0");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    const vichar = document.createElement("div");
    vichar.id = "vichar-root";
    vichar.innerHTML = "<textarea>Vichar by @vtrrk</textarea>";
    host.append(composer, vichar);
    document.body.appendChild(host);

    expect(composerText(host)).toBe("");
  });

  it("ignores a reply composer inside an article", () => {
    const article = document.createElement("article");
    const replyComposer = document.createElement("div");
    replyComposer.setAttribute("data-testid", "tweetTextarea_0");
    replyComposer.setAttribute("contenteditable", "true");
    replyComposer.setAttribute("role", "textbox");
    Object.defineProperty(replyComposer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    article.appendChild(replyComposer);
    document.body.appendChild(article);

    expect(findComposer()).toBeNull();
  });

  it("prefers a fresh post composer over a reply composer", () => {
    const article = document.createElement("article");
    const replyComposer = document.createElement("div");
    replyComposer.setAttribute("data-testid", "tweetTextarea_reply");
    replyComposer.setAttribute("contenteditable", "true");
    replyComposer.setAttribute("role", "textbox");
    Object.defineProperty(replyComposer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    article.appendChild(replyComposer);

    const freshComposer = document.createElement("div");
    freshComposer.setAttribute("data-testid", "tweetTextarea_post");
    freshComposer.setAttribute("contenteditable", "true");
    freshComposer.setAttribute("role", "textbox");
    Object.defineProperty(freshComposer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });

    document.body.append(article, freshComposer);

    expect(findComposer()).toBe(freshComposer);
  });

  it("ignores a search textbox", () => {
    const search = document.createElement("div");
    search.setAttribute("contenteditable", "true");
    search.setAttribute("role", "textbox");
    search.setAttribute("aria-label", "Search");
    Object.defineProperty(search, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 40 })
    });
    document.body.appendChild(search);

    expect(findComposer()).toBeNull();
  });

  it("prefers the Post dialog composer over the inline Home composer", () => {
    const inline = document.createElement("div");
    inline.setAttribute("data-testid", "tweetTextarea_0");
    inline.setAttribute("contenteditable", "true");
    inline.setAttribute("role", "textbox");
    Object.defineProperty(inline, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const modalComposer = document.createElement("div");
    modalComposer.setAttribute("data-testid", "tweetTextarea_1");
    modalComposer.setAttribute("contenteditable", "true");
    modalComposer.setAttribute("role", "textbox");
    Object.defineProperty(modalComposer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    dialog.appendChild(modalComposer);
    document.body.append(inline, dialog);

    expect(findComposer()).toBe(modalComposer);
  });

  it("resolves the composer host to the parent of X's native toolbar", () => {
    const host = document.createElement("div");
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-testid", "toolBar");
    const composer = document.createElement("div");
    host.append(toolbar, composer);
    document.body.appendChild(host);

    expect(composerHost(composer)).toBe(host);
  });

  it("resolves the composer host to its form", () => {
    const form = document.createElement("form");
    const composer = document.createElement("div");
    form.appendChild(composer);
    document.body.appendChild(form);

    expect(composerHost(composer)).toBe(form);
  });

  it("finds an inline composer when no dialog is open", () => {
    const composer = document.createElement("div");
    composer.setAttribute("data-testid", "tweetTextarea_0");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    expect(findComposer()).toBe(composer);
  });

  it("copies text to the clipboard using the safe fallback", async () => {
    const originalClipboard = navigator.clipboard;
    const originalExecCommand = document.execCommand;
    const commands: string[] = [];

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    });
    document.execCommand = ((command: string) => {
      commands.push(command);
      return command === "copy";
    }) as typeof document.execCommand;

    try {
      expect(await copyTextToClipboard("Vichar by vtrrk")).toBe(true);
      expect(commands).toEqual(["copy"]);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard
      });
      document.execCommand = originalExecCommand;
    }
  });

  it("replaces an existing draft instead of appending", async () =>
    const composer = document.createElement("div");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    composer.textContent = "Old draft";
    const originalExecCommand = document.execCommand;
    const commands: string[] = [];
    document.execCommand = ((command: string) => {
      commands.push(command);
      return command === "selectAll";
    }) as typeof document.execCommand;

    class FakeDataTransfer {
      private readonly values = new Map<string, string>();

      setData(type: string, value: string): void {
        this.values.set(type, value);
      }

      getData(type: string): string {
        return this.values.get(type) ?? "";
      }

      clearData(): void {
        this.values.clear();
      }
    }

    class FakeClipboardEvent extends Event {
      readonly clipboardData: FakeDataTransfer;

      constructor(type: string, init: { clipboardData: FakeDataTransfer }) {
        super(type, { bubbles: true, cancelable: true });
        this.clipboardData = init.clipboardData;
      }
    }

    vi.stubGlobal("DataTransfer", FakeDataTransfer);
    vi.stubGlobal("ClipboardEvent", FakeClipboardEvent);

    const originalDispatchEvent = composer.dispatchEvent;
    composer.dispatchEvent = ((event: Event) => {
      const clipboardData = (event as ClipboardEvent).clipboardData;
      composer.textContent = clipboardData?.getData("text/plain") ?? "";
      event.preventDefault();
      return false;
    }) as typeof composer.dispatchEvent;

    try {
      const first = await replaceComposerText(composer, "New draft");
      const second = await replaceComposerText(composer, "Second draft");

      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(composerText(composer)).toBe("Second draft");
      expect(commands).toEqual(["selectAll", "selectAll"]);
    } finally {
      document.execCommand = originalExecCommand;
      composer.dispatchEvent = originalDispatchEvent;
      vi.unstubAllGlobals();
    }
  });
});
