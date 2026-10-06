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

export function composerToolbar(composer: HTMLElement): HTMLElement | null {
  const scope =
    composer.closest('[role="dialog"]') ||
    composer.closest('[aria-modal="true"]') ||
    composer.closest("form") ||
    document;

  const postButton = findPostButton(composer);
  const toolbar = postButton?.closest<HTMLElement>('[data-testid="toolBar"]');
  if (toolbar) {
    return toolbar;
  }

  // X can briefly render the toolbar before the native Post button is
  // available. Prefer that toolbar rather than mounting TweetPilot outside
  // the native composer structure.
  return scope.querySelector<HTMLElement>('[data-testid="toolBar"]');
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

/**
 * Resolve the actual X contenteditable using the same ancestor/descendant
 * search pattern used by TweetAI. This matters because X can wrap the editor
 * in several non-editable divs and can replace those wrappers dynamically.
 */
export function resolveEditableComposer(element: HTMLElement): HTMLElement {
  let node: HTMLElement | null = element;

  while (node) {
    if (node.getAttribute("contenteditable") === "true") {
      return node;
    }

    const descendant = node.querySelector<HTMLElement>(
      '[contenteditable="true"]'
    );
    if (descendant) {
      return descendant;
    }

    node = node.parentElement;
  }

  return element;
}

export async function replaceComposerText(
  composer: HTMLElement,
  text: string
): Promise<boolean> {
  composer = resolveEditableComposer(composer);

  // Match TweetAI's proven X integration first: focus the native editor,
  // select its contents, send Delete, then send textInput with the new text.
  // Do not synthesize an extra "input" delete event here; X's editor owns the
  // state transition and the extra event can leave its internal state stale.
  composer.focus();
  selectAllComposerText(composer);
  composer.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Delete",
      bubbles: true
    })
  );

  await wait(100);

  composer.dispatchEvent(
    new InputEvent("textInput", {
      data: text,
      bubbles: true
    })
  );

  // X may update its React/editor state asynchronously after textInput.
  await wait(250);

  if (composerText(composer) === text || isPostButtonEnabled(composer)) {
    return true;
  }

  // Fallback for X/editor variants that do not handle TweetAI's textInput
  // path. execCommand goes through Chromium's editing pipeline and emits the
  // browser's native editing events.
  selectAllComposerText(composer);
  try {
    if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, text);
    }
  } catch {
    // Continue to the final verification below.
  }

  await wait(200);
  return composerText(composer) === text || isPostButtonEnabled(composer);
}
