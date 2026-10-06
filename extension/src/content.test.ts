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

  it("treats X's composer placeholder as an empty draft", () => {
    const composer = document.createElement("div");
    composer.setAttribute("data-testid", "tweetTextarea_0");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    composer.textContent = "What's happening?";
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    expect(composerText(composer)).toBe("");
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

  it("can replace composer text and emit textInput", async () => {
    const composer = document.createElement("div");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    Object.defineProperty(composer, "getBoundingClientRect", {
      value: () => ({ width: 300, height: 80 })
    });
    document.body.appendChild(composer);

    let textInputEvents = 0;
    composer.addEventListener("textInput", () => {
      textInputEvents += 1;
    });

    composer.textContent = "New draft";
    const result = await replaceComposerText(composer, "New draft");

    expect(result).toBe(true);
    expect(composerText(composer)).toBe("New draft");
    expect(textInputEvents).toBe(1);
  });
});
