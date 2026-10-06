const COMPOSER_SELECTORS = [
  '[data-testid^="tweetTextarea_"]',
  'div[contenteditable="true"][role="textbox"]'
];

const SEARCH_HINTS = ["search", "query"];

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function looksLikeSearchBox(element: HTMLElement): boolean {
  const aria = (element.getAttribute("aria-label") || "").toLowerCase();
  const placeholder = (
    element.getAttribute("data-placeholder") || ""
  ).toLowerCase();
  const surrounding = (element.closest("form")?.innerText || "").toLowerCase();

  return SEARCH_HINTS.some((hint) =>
    `${aria} ${placeholder} ${surrounding}`.includes(hint)
  );
}

export function findComposer(root: ParentNode = document): HTMLElement | null {
  for (const selector of COMPOSER_SELECTORS) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(selector)
    );

    const composer = candidates.find(
      (candidate) =>
        isVisible(candidate) &&
        !looksLikeSearchBox(candidate) &&
        !candidate.closest("#tweetpilot-root")
    );

    if (composer) {
      return composer;
    }
  }

  return null;
}

export function composerText(composer: HTMLElement): string {
  return (composer.innerText || composer.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function composerHost(composer: HTMLElement): HTMLElement {
  return (
    composer.closest("form") ||
    composer.closest('[role="dialog"]') ||
    composer.parentElement ||
    document.body
  ) as HTMLElement;
}

function selectAllComposerText(composer: HTMLElement): void {
  composer.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function replaceComposerText(
  composer: HTMLElement,
  text: string
): void {
  selectAllComposerText(composer);

  // X currently uses a Draft.js contenteditable for the tweet composer.
  // execCommand(insertText) is preferable to mutating textContent because it
  // produces the browser editing events Draft.js expects.
  const execCommand = document.execCommand;
  const inserted =
    typeof execCommand === "function"
      ? execCommand.call(document, "insertText", false, text)
      : false;

  if (!inserted || composerText(composer) !== text) {
    // Give Draft.js a second, event-driven path. In a real browser,
    // execCommand is the preferred path because it updates the editor's
    // native editing state. The DOM fallback is retained for test/jsdom
    // environments where execCommand is unavailable.
    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    });
    composer.dispatchEvent(beforeInput);

    if (typeof execCommand === "function") {
      selectAllComposerText(composer);
      execCommand.call(document, "insertText", false, text);
    } else {
      composer.textContent = text;
    }
  }

  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    })
  );
}
