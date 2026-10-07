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
        !candidate.closest("#vichar-root")
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
  const editable = resolveEditableComposer(composer);
  return (editable.innerText || editable.textContent || "")
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

  // Prefer the browser's native select-all command so X receives the same
  // editing selection it would see from Cmd/Ctrl+A inside its composer.
  try {
    if (
      typeof document.execCommand === "function" &&
      document.execCommand("selectAll", false)
    ) {
      return;
    }
  } catch {
    // Fall through to the DOM Range fallback below.
  }

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

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy copy command below.
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();

  let copied = false;
  try {
    copied =
      typeof document.execCommand === "function" &&
      document.execCommand("copy", false);
  } catch {
    copied = false;
  } finally {
    helper.remove();
  }

  return copied;
}

function dispatchPaste(composer: HTMLElement, text: string): boolean {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", text);

  const event = new ClipboardEvent("paste", {
    clipboardData: dataTransfer,
    bubbles: true,
    cancelable: true
  });

  const dispatched = composer.dispatchEvent(event);
  dataTransfer.clearData();

  return dispatched || event.defaultPrevented;
}

export async function replaceComposerText(
  composer: HTMLElement,
  text: string
): Promise<boolean> {
  composer = resolveEditableComposer(composer);

  // X uses a Draft.js-style contenteditable editor. Direct DOM mutation and
  // execCommand("insertText") can make text visible without committing the
  // corresponding editor state. Use the editor's paste pathway instead.
  selectAllComposerText(composer);

  let replaced = false;
  try {
    replaced = dispatchPaste(composer, text);
  } catch {
    // Leave the composer untouched if the browser rejects synthetic paste.
  }

  await wait(300);

  return replaced && composerText(composer) === text;
}
