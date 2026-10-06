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

function composerCandidates(root: ParentNode): HTMLElement[] {
  for (const selector of COMPOSER_SELECTORS) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(selector)
    ).filter(
      (candidate) =>
        isVisible(candidate) &&
        !looksLikeSearchBox(candidate) &&
        !candidate.closest("#tweetpilot-root")
    );

    if (candidates.length > 0) {
      return candidates;
    }
  }

  return [];
}

function isInComposerDialog(element: HTMLElement): boolean {
  return Boolean(
    element.closest('[role="dialog"]') ||
      element.closest('[aria-modal="true"]')
  );
}

export function findComposer(root: ParentNode = document): HTMLElement | null {
  // TweetAI integrates with both X's inline composer and the Post dialog.
  // Prefer the dialog when it exists, otherwise use the visible inline editor.
  const allCandidates = composerCandidates(root);
  const dialogComposer = allCandidates.find(isInComposerDialog);

  return dialogComposer ?? allCandidates[0] ?? null;
}

export function composerText(composer: HTMLElement): string {
  return (composer.innerText || composer.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function findPostButton(composer: HTMLElement): HTMLElement | null {
  const scope =
    composer.closest('[role="dialog"]') ||
    composer.closest('[aria-modal="true"]') ||
    composer.closest("form") ||
    document;

  return scope.querySelector<HTMLElement>(
    '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
  );
}

export function composerToolbar(composer: HTMLElement): HTMLElement | null {
  return findPostButton(composer)?.closest('[data-testid="toolBar"]') || null;
}

export function composerHost(composer: HTMLElement): HTMLElement {
  const toolbar = composerToolbar(composer);
  return (
    toolbar?.parentElement ||
    composer.closest('[role="dialog"]') ||
    composer.closest('[aria-modal="true"]') ||
    composer.closest("form") ||
    composer.parentElement ||
    document.body
  ) as HTMLElement;
}

function findPostButton(composer: HTMLElement): HTMLElement | null {
  const scope =
    composer.closest('[role="dialog"]') ||
    composer.closest('[aria-modal="true"]') ||
    composer.closest("form") ||
    document;

  return scope.querySelector<HTMLElement>(
    '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
  );
}

export function isPostButtonEnabled(composer: HTMLElement): boolean {
  const button = findPostButton(composer);
  if (!button) {
    return false;
  }

  return (
    button.getAttribute("aria-disabled") !== "true" &&
    !(button as HTMLButtonElement).disabled
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function selectAllComposerText(composer: HTMLElement): void {
  composer.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export async function replaceComposerText(
  composer: HTMLElement,
  text: string
): Promise<boolean> {
  // TweetAI's current X integration uses the native contenteditable event
  // path: select the existing editor contents, send Delete, then send a
  // textInput event carrying the generated text. This lets X handle the
  // editor state instead of merely changing the DOM.
  composer.focus();
  selectAllComposerText(composer);
  composer.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Delete",
      bubbles: true
    })
  );
  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward"
    })
  );

  await wait(100);

  composer.dispatchEvent(
    new InputEvent("textInput", {
      data: text,
      bubbles: true
    })
  );

  await wait(150);

  if (composerText(composer) === text) {
    return true;
  }

  // Fallback for X/editor variants that don't handle the textInput path.
  // execCommand generates the browser's editing events for contenteditable.
  selectAllComposerText(composer);
  const execCommand = document.execCommand;
  if (typeof execCommand === "function") {
    execCommand.call(document, "insertText", false, text);
  } else {
    composer.textContent = text;
    composer.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
  }

  await wait(100);
  return composerText(composer) === text; 
}
