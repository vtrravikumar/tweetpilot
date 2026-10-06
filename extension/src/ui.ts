import { DEFAULT_MAX_LENGTH, PANEL_ID } from "./constants";
import { TOPICS, type TopicSelection } from "./types";
import {
  composerHost,
  composerToolbar,
  composerText,
  isPostButtonEnabled,
  replaceComposerText
} from "./dom";

export interface PanelCallbacks {
  onGenerate: (topic: TopicSelection, location: string) => void;
  onDismiss: () => void;
  onReopen: () => void;
}

export interface TweetPanel {
  element: HTMLDivElement;
  setLoading: (loading: boolean) => void;
  setTweet: (tweet: string, resolvedTopic: string) => void;
  setError: (message: string) => void;
  setVisible: (visible: boolean) => void;
  getTopic: () => TopicSelection;
  getLocation: () => string;
  getComposer: () => HTMLElement | null;
  setComposer: (composer: HTMLElement | null) => void;
  setDismissed: (dismissed: boolean) => void;
  getTweet: () => string;
}

export function createPanel(callbacks: PanelCallbacks): TweetPanel {
  document.getElementById(PANEL_ID)?.remove();

  const root = document.createElement("div");
  root.id = PANEL_ID;
  root.setAttribute("data-vichar", "true");
  root.innerHTML = `
    <div class="vc-card">
      <div class="vc-header">
        <div class="vc-brand-lockup">
          <img class="vc-mark" src="${chrome.runtime.getURL("icon128.png")}" alt="" width="30" height="30" />
          <div>
            <div class="vc-brand"><span class="vc-word">V<span class="vc-ai-i">i</span>ch<span class="vc-ai-a">a</span>r</span> <span>By VTRRK</span></div>
            <div class="vc-subtitle">Vichārāt Vākyam Bhavati <span aria-hidden="true">·</span> From thought to expression.</div>
          </div>
        </div>
        <button type="button" class="vc-icon-button" aria-label="Dismiss Vichar">×</button>
      </div>

      <div class="vc-controls">
        <label>
          <span>Topic</span>
          <input
            class="vc-topic"
            type="text"
            list="vc-topic-options"
            maxlength="100"
            autocomplete="off"
            placeholder="Choose or type a topic"
          />
          <datalist id="vc-topic-options"></datalist>
        </label>
        <label>
          <span>Location <em>optional</em></span>
          <input class="vc-location" type="text" maxlength="80" placeholder="e.g. Chennai" />
        </label>
      </div>

      <div class="vc-status" aria-live="polite"></div>

      <div class="vc-suggestion-wrap">
        <textarea class="vc-suggestion" maxlength="${DEFAULT_MAX_LENGTH}" aria-label="Vichar thought"></textarea>
        <div class="vc-count">0/${DEFAULT_MAX_LENGTH}</div>
      </div>

      <div class="vc-actions">
        <button type="button" class="vc-primary">Get a thought</button>
        <button type="button" class="vc-secondary vc-another" disabled>Another thought</button>
        <button type="button" class="vc-secondary vc-dismiss">Dismiss</button>
      </div>

      <div class="vc-footer">You decide what gets posted.</div>
    </div>
    <button type="button" class="vc-reopen">Vichar</button>
  `;

  document.body.appendChild(root);

  const topicInput = root.querySelector<HTMLInputElement>(".vc-topic")!;
  const topicOptions = root.querySelector<HTMLDataListElement>("#vc-topic-options")!;
  for (const topic of TOPICS) {
    const option = document.createElement("option");
    option.value = topic;
    topicOptions.appendChild(option);
  }
  topicInput.value = "Surprise me";

  const locationInput = root.querySelector<HTMLInputElement>(".vc-location")!;
  const status = root.querySelector<HTMLDivElement>(".vc-status")!;
  const suggestion = root.querySelector<HTMLTextAreaElement>(".vc-suggestion")!;
  const count = root.querySelector<HTMLDivElement>(".vc-count")!;
  const primary = root.querySelector<HTMLButtonElement>(".vc-primary")!;
  const another = root.querySelector<HTMLButtonElement>(".vc-another")!;
  const dismiss = root.querySelector<HTMLButtonElement>(".vc-dismiss")!;
  const close = root.querySelector<HTMLButtonElement>(".vc-icon-button")!;
  const reopen = root.querySelector<HTMLButtonElement>(".vc-reopen")!;

  let composer: HTMLElement | null = null;
  let hasTweet = false;
  let replaceConfirmedForDraftForDraft: string | null = null;

  const updateCount = () => {
    count.textContent = `${suggestion.value.length}/${DEFAULT_MAX_LENGTH}`;
  };

  suggestion.addEventListener("input", updateCount);

  primary.addEventListener("click", () => {
    if (!composer) {
      status.textContent = "Open the X composer first.";
      return;
    }

    if (!hasTweet) {
      status.textContent = "Vichāraṁ Labhatām… · Get a thought…";
      callbacks.onGenerate(topicInput.value.trim() || "Surprise me", locationInput.value);
      return;
    }

    const tweet = suggestion.value.trim();
    if (!tweet) {
      hasTweet = false;
      primary.textContent = "Get a thought";
      another.disabled = true;
      status.textContent = "Get a thought first.";
      return;
    }

    const current = composerText(composer);
    if (current === tweet) {
      status.textContent =
        "Already in X. Edit it if you like, then use X's native Post button.";
      return;
    }

    if (current && replaceConfirmedForDraftForDraft !== current) {
      replaceConfirmedForDraftForDraft = current;
      primary.textContent = "Replace draft?";
      status.textContent = "X already has a draft. Choose Replace draft? to overwrite it.";
      return;
    }

    status.textContent = "Adding to X…";
    void (async () => {
      const inserted = await replaceComposerText(composer, tweet);
      replaceConfirmedForDraftForDraft = null;
      if (!inserted || composerText(composer) !== tweet) {
        status.textContent =
          "X did not accept the suggestion. You can copy it and paste it into the composer.";
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (!isPostButtonEnabled(composer)) {
        status.textContent =
          "The text is in the X editor, but X has not enabled Post yet. Edit the draft or try Use this again.";
        return;
      }

      status.textContent =
        "Added to X. Edit it if you like, then use X's native Post button.";
    })();
  });

  another.addEventListener("click", () => {
    status.textContent = "Vichāraṁ Labhatām… · Get a thought…";
    callbacks.onGenerate(topicInput.value.trim() || "Surprise me", locationInput.value);
  });

  const invalidateSuggestion = (message: string) => {
    hasTweet = false;
    replaceConfirmedForDraft = false;
    suggestion.value = "";
    updateCount();
    primary.textContent = "Get a thought";
    primary.disabled = false;
    another.disabled = true;
    status.textContent = message;
  };

  topicInput.addEventListener("input", () => {
    invalidateSuggestion("Topic changed. Choose Get a thought when you're ready.");
  });

  locationInput.addEventListener("change", () => {
    invalidateSuggestion(
      "Location changed. Choose Get a thought when you're ready."
    );
  });
  dismiss.addEventListener("click", callbacks.onDismiss);
  close.addEventListener("click", callbacks.onDismiss);
  reopen.addEventListener("click", callbacks.onReopen);

  return {
    element: root,
    setLoading(loading) {
      root.classList.toggle("vc-loading", loading);
      primary.disabled = loading;
      another.disabled = loading || !hasTweet;
      topicInput.disabled = loading;
      locationInput.disabled = loading;
      if (loading) {
        status.textContent = "Vichāraḥ Sṛjyate… · Creating a thought…";
      }
    },
    setTweet(tweet, resolvedTopic) {
      hasTweet = true;
      replaceConfirmedForDraft = false;
      suggestion.value = tweet;
      updateCount();
      status.textContent = `Vichāraḥ · ${resolvedTopic} · Thought`;
      primary.textContent = "Use this";
      primary.disabled = false;
      another.textContent = "Another thought";
      another.disabled = false;
    },
    setError(message) {
      hasTweet = false;
      replaceConfirmedForDraft = false;
      root.classList.remove("vc-loading");
      status.textContent = message;
      primary.textContent = "Get a thought";
      primary.disabled = false;
      another.disabled = true;
    },
    setVisible(visible) {
      root.classList.toggle("vc-inactive", !visible);
    },
    getTopic: () => (topicInput.value.trim() || "Surprise me") as TopicSelection,
    getLocation: () => locationInput.value.trim(),
    getComposer: () => composer,
    setComposer: (value) => {
      if (value !== composer) {
        hasTweet = false;
        replaceConfirmedForDraft = false;
        suggestion.value = "";
        updateCount();
        primary.textContent = "Get a thought";
        another.textContent = "Another thought";
        another.disabled = true;
        primary.disabled = false;
        status.textContent = "Vichāraṁ Labhatām — Get a thought when you want an idea.";
      }

      composer = value;

      const host = value ? composerHost(value) : document.body;
      if (value && host) {
        const toolbar = composerToolbar(value);
        if (toolbar?.parentElement === host) {
          if (root.parentElement !== host || root.nextSibling !== toolbar) {
            host.insertBefore(root, toolbar);
          }
        } else if (root.parentElement !== host) {
          host.appendChild(root);
        }
      } else if (root.parentElement !== host) {
        host.appendChild(root);
      }
    },
    setDismissed(dismissed) {
      root.classList.toggle("vc-dismissed", dismissed);
    },
    getTweet: () => suggestion.value.trim()
  };
}
