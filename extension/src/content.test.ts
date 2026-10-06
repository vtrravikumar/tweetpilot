import { beforeEach, describe, expect, it } from "vitest";
import { composerHost, composerText, findComposer, replaceComposerText } from "./dom";
import { resolveTopic } from "./topic";

describe("topic resolution", () => {
  it("keeps an explicit topic", () => {
    expect(resolveTopic("Photography")).toBe("Photography");
  });

  it("resolves Surprise me to a real topic", () => {
    expect(resolveTopic("Surprise me")).not.toBe("Surprise me");
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

  it("resolves the composer host to its form", () => {\n    const form = document.createElement("form");\n    const composer = document.createElement("div");\n    form.appendChild(composer);\n    document.body.appendChild(form);\n\n    expect(composerHost(composer)).toBe(form);\n  });\n\n  it("can replace composer text and emit input", () => {
    const composer = document.createElement("div");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    let inputEvents = 0;
    composer.addEventListener("input", () => {
      inputEvents += 1;
    });

    replaceComposerText(composer, "New draft");

    expect(composerText(composer)).toBe("New draft");
    expect(inputEvents).toBe(1);
  });
});
