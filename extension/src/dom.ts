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

// --- Reply detection --------------------------------------------------------
//
// X uses the same Draft.js-style editor for posts and replies, so Vichar
// needs to classify the editor from X's surrounding UI. No single signal is
// guaranteed to remain stable, so we use several signals in descending order
// of confidence.
//
// 1. X's native "Post your reply" / "Tweet your reply" placeholder.
// 2. A per-editor latch so the reply classification survives typing, which
//    removes the placeholder.
// 3. Reply-dialog contents: the original tweet or "Replying to @..." label.
// 4. X's native Reply submit action.
// 5. An article ancestor as a final fallback for inline reply composers.
//
// We intentionally do not use the /status/<id> URL as a global reply signal:
// a tweet-detail page can still contain a legitimate new-post composer.

const REPLY_PLACEHOLDER = /\b(post|tweet) your reply\b/i;
const REPLYING_TO = /\breplying to\b/i;
const knownReplyEditors = new WeakSet<HTMLElement>();

function placeholderText(composer: HTMLElement): string | null {
  const editor = resolveEditableComposer(composer);
  const container = composer.closest<HTMLElement>(
    '[data-testid$="RichTextInputContainer"]'
  );
  const root =
    container?.querySelector<HTMLElement>(".DraftEditor-root") ??
    editor.closest<HTMLElement>(".DraftEditor-root") ??
    composer.closest<HTMLElement>(".DraftEditor-root") ??
    container ??
    composer;

  const placeholder = root.querySelector<HTMLElement>(
    '[class*="DraftEditorPlaceholder"]'
  );

  return placeholder ? (placeholder.textContent ?? "").trim() : null;
}

function dialogShowsOriginalPost(composer: HTMLElement): boolean {
  const dialog = composer.closest<HTMLElement>(
    '[role="dialog"], [aria-modal="true"]'
  );
  if (!dialog) {
    return false;
  }

  return (
    Boolean(
      dialog.querySelector(
        'article, [data-testid="tweet"], [data-testid="tweetText"]'
      )
    ) || REPLYING_TO.test(dialog.textContent ?? "")
  );
}

export function isReplyComposer(composer: HTMLElement): boolean {
  const editor = resolveEditableComposer(composer);
  const placeholder = placeholderText(composer);

  if (placeholder !== null && REPLY_PLACEHOLDER.test(placeholder)) {
    knownReplyEditors.add(editor);
    return true;
  }

  if (dialogShowsOriginalPost(composer)) {
    knownReplyEditors.add(editor);
    return true;
  }

  const form = composer.closest("form");
  const postButton = form?.querySelector<HTMLElement>(
    '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
  );
  const buttonText = (
    `${postButton?.textContent ?? ""} ${postButton?.getAttribute("aria-label") ?? ""}`
  ).trim().toLowerCase();

  if (/\breply\b/.test(buttonText)) {
    knownReplyEditors.add(editor);
    return true;
  }

  if (placeholder !== null) {
    // A visible non-reply placeholder is strong evidence of a new post.
    knownReplyEditors.delete(editor);
    return false;
  }

  if (knownReplyEditors.has(editor)) {
    return true;
  }

  return Boolean(composer.closest("article"));
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
  // Prefer a composer in an open dialog. If the dialog is a reply, return
  // null rather than falling back to a Home composer behind the dialog.
  const allCandidates = composerCandidates(root);
  const dialogCandidates = allCandidates.filter(isInComposerDialog);

  if (dialogCandidates.length > 0) {
    return dialogCandidates.find((candidate) => !isReplyComposer(candidate)) ?? null;
  }

  return allCandidates.find((candidate) => !isReplyComposer(candidate)) ?? null;
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
