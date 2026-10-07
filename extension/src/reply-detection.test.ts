import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findComposer, isReplyComposer } from "./dom";

const NEW_POST_PLACEHOLDER = "What is happening?!";
const REPLY_PLACEHOLDER = "Post your reply";

interface XComposer {
  container: HTMLElement;
  editable: HTMLElement;
  setPlaceholder(text: string | null): void;
  type(text: string): void;
}

function visible(element: HTMLElement): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({ width: 300, height: 80 })
  });
}

function xComposer(placeholder: string | null): XComposer {
  const container = document.createElement("div");
  container.setAttribute(
    "data-testid",
    "tweetTextarea_0RichTextInputContainer"
  );

  const draftRoot = document.createElement("div");
  draftRoot.className = "DraftEditor-root";

  const placeholderRoot = document.createElement("div");
  placeholderRoot.className = "public-DraftEditorPlaceholder-root";

  const placeholderInner = document.createElement("div");
  placeholderInner.className = "public-DraftEditorPlaceholder-inner";
  placeholderRoot.appendChild(placeholderInner);

  const editorContainer = document.createElement("div");
  editorContainer.className = "DraftEditor-editorContainer";

  const editable = document.createElement("div");
  editable.setAttribute("data-testid", "tweetTextarea_0");
  editable.setAttribute("contenteditable", "true");
  editable.setAttribute("role", "textbox");

  editorContainer.appendChild(editable);
  draftRoot.append(placeholderRoot, editorContainer);
  container.appendChild(draftRoot);

  [container, draftRoot, editorContainer, editable].forEach(visible);

  let currentPlaceholder: HTMLElement | null = placeholderRoot;

  const setPlaceholder = (text: string | null): void => {
    if (text === null) {
      placeholderRoot.remove();
      currentPlaceholder = null;
      return;
    }

    placeholderInner.textContent = text;
    if (!currentPlaceholder) {
      draftRoot.insertBefore(placeholderRoot, editorContainer);
      currentPlaceholder = placeholderRoot;
    }
  };

  setPlaceholder(placeholder);

  return {
    container,
    editable,
    setPlaceholder,
    type: (text: string) => {
      setPlaceholder(null);
      editable.textContent = text;
    }
  };
}

function dialogWith(...children: HTMLElement[]): HTMLElement {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.append(...children);
  return dialog;
}

function originalPost(): HTMLElement {
  const article = document.createElement("article");
  article.setAttribute("data-testid", "tweet");
  const body = document.createElement("div");
  body.setAttribute("data-testid", "tweetText");
  body.textContent = "Original post";
  article.appendChild(body);
  return article;
}

function isFound(composer: XComposer): boolean {
  const found = findComposer();
  return found === composer.container || found === composer.editable;
}

describe("reply composer exclusion", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("recognises X's Post your reply placeholder", () => {
    const composer = xComposer(REPLY_PLACEHOLDER);
    document.body.appendChild(composer.container);

    expect(findComposer()).toBeNull();
    expect(isReplyComposer(composer.editable)).toBe(true);
  });

  it("recognises the older Tweet your reply placeholder", () => {
    const composer = xComposer("Tweet your reply");
    document.body.appendChild(composer.container);

    expect(findComposer()).toBeNull();
  });

  it("does not classify a fresh-post placeholder as a reply", () => {
    const composer = xComposer(NEW_POST_PLACEHOLDER);
    document.body.appendChild(composer.container);

    expect(isFound(composer)).toBe(true);
    expect(isReplyComposer(composer.editable)).toBe(false);
  });

  it("keeps a reply classified after typing removes the placeholder", () => {
    const composer = xComposer(REPLY_PLACEHOLDER);
    document.body.appendChild(composer.container);

    expect(findComposer()).toBeNull();
    composer.type("Thanks for sharing");

    expect(findComposer()).toBeNull();
    expect(isReplyComposer(composer.editable)).toBe(true);
  });

  it("drops the reply latch when the same editor shows a fresh-post placeholder", () => {
    const composer = xComposer(REPLY_PLACEHOLDER);
    document.body.appendChild(composer.container);

    expect(findComposer()).toBeNull();

    composer.setPlaceholder(NEW_POST_PLACEHOLDER);
    expect(isFound(composer)).toBe(true);

    composer.type("Now writing a new post");
    expect(isFound(composer)).toBe(true);
  });

  it("does not let a reply editor latch affect another editor", () => {
    const reply = xComposer(REPLY_PLACEHOLDER);
    document.body.appendChild(reply.container);
    expect(findComposer()).toBeNull();
    reply.container.remove();

    const fresh = xComposer(NEW_POST_PLACEHOLDER);
    document.body.appendChild(fresh.container);

    expect(isFound(fresh)).toBe(true);
  });

  it("recognises a reply dialog from the original tweet", () => {
    const composer = xComposer(null);
    document.body.appendChild(dialogWith(originalPost(), composer.container));

    expect(findComposer()).toBeNull();
  });

  it("recognises a reply dialog from the Replying to label", () => {
    const composer = xComposer(null);
    const label = document.createElement("div");
    label.textContent = "Replying to @TrichyTreasures";
    document.body.appendChild(dialogWith(label, composer.container));

    expect(findComposer()).toBeNull();
  });

  it("keeps a reply dialog hidden after typing", () => {
    const composer = xComposer(REPLY_PLACEHOLDER);
    document.body.appendChild(dialogWith(originalPost(), composer.container));
    composer.type("My reply");

    expect(findComposer()).toBeNull();
  });

  it("does not fall back to Home when a reply dialog is open", () => {
    const inline = xComposer(NEW_POST_PLACEHOLDER);
    const reply = xComposer(null);
    document.body.append(
      inline.container,
      dialogWith(originalPost(), reply.container)
    );

    expect(findComposer()).toBeNull();
  });

  it("still finds a normal new-post dialog", () => {
    const composer = xComposer(NEW_POST_PLACEHOLDER);
    document.body.appendChild(dialogWith(composer.container));

    expect(isFound(composer)).toBe(true);
  });

  it("does not use timeline reply text to hide a Home composer", () => {
    const composer = xComposer(NEW_POST_PLACEHOLDER);
    const timeline = document.createElement("div");
    const label = document.createElement("div");
    label.textContent = "Replying to @someone";
    timeline.append(originalPost(), label);
    document.body.append(composer.container, timeline);

    expect(isFound(composer)).toBe(true);
  });

  it("uses the Reply submit action as a fallback", () => {
    const form = document.createElement("form");
    const composer = xComposer(null);
    const button = document.createElement("button");
    button.setAttribute("data-testid", "tweetButton");
    button.textContent = "Reply";
    form.append(composer.container, button);
    document.body.appendChild(form);

    expect(findComposer()).toBeNull();
  });

  it("still finds a fresh composer with no reply signals", () => {
    const composer = xComposer(null);
    composer.editable.textContent = "Existing draft";
    document.body.appendChild(composer.container);

    expect(isFound(composer)).toBe(true);
  });

  it("does not use a post-page URL as a reply signal", () => {
    const composer = xComposer(NEW_POST_PLACEHOLDER);
    document.body.appendChild(composer.container);
    window.history.pushState({}, "", "/someone/status/42");

    expect(isFound(composer)).toBe(true);
    window.history.pushState({}, "", "/");
  });
});
