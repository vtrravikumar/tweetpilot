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

export function replaceComposerText(
  composer: HTMLElement,
  text: string
): void {
  composer.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const execCommand = document.execCommand;
  const inserted =
    typeof execCommand === "function"
      ? execCommand.call(document, "insertText", false, text)
      : false;

  if (!inserted) {
    composer.textContent = text;
  }

  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    })
  );
}
