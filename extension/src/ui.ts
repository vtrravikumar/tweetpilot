import { DEFAULT_MAX_LENGTH, PANEL_ID } from "./constants";
import { TOPICS, type Topic } from "./types";
import {
  composerHost,
  composerToolbar,
  composerText,
  isPostButtonEnabled,
  replaceComposerText
} from "./dom";

export interface PanelCallbacks {
  onGenerate: (topic: Topic, location: string) => void;
  onDismiss: () => void;
  onReopen: () => void;
}

export interface TweetPanel {
  element: HTMLDivElement;
  setLoading: (loading: boolean) => void;
  setTweet: (tweet: string, resolvedTopic: string) => void;
  setError: (message: string) => void;
  setVisible: (visible: boolean) => void;
  getTopic: () => Topic;
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
  root.setAttribute("data-tweetpilot", "true");
  root.innerHTML = `
    <div class="tp-card">
      <div class="tp-header">
        <div>
          <div class="tp-brand">TweetPilot <span>By VTRRK</span></div>
          <div class="tp-subtitle">AI writing companion</div>
        </div>
        <button type="button" class="tp-icon-button" aria-label="Dismiss TweetPilot">×</button>
      </div>

      <div class="tp-controls">
        <label>
          <span>Topic</span>
          <select class="tp-topic"></select>
        </label>
        <label>
          <span>Location <em>optional</em></span>
          <input class="tp-location" type="text" maxlength="80" placeholder="e.g. Chennai" />
        </label>
      </div>

      <div class="tp-status" aria-live="polite"></div>

      <div class="tp-suggestion-wrap">
        <textarea class="tp-suggestion" maxlength="${DEFAULT_MAX_LENGTH}" aria-label="Tweet suggestion"></textarea>
        <div class="tp-count">0/${DEFAULT_MAX_LENGTH}</div>
      </div>

      <div class="tp-actions">
        <button type="button" class="tp-primary">Inspire Tweet</button>
        <button type="button" class="tp-secondary tp-another" disabled>Change tweet</button>
        <button type="button" class="tp-secondary tp-dismiss">Dismiss</button>
      </div>

      <div class="tp-footer">You decide what gets posted.</div>
    </div>
    <button type="button" class="tp-reopen">TweetPilot</button>
  `;

  document.body.appendChild(root);

  const topicSelect = root.querySelector<HTMLSelectElement>(".tp-topic")!;
  for (const topic of TOPICS) {
    const option = document.createElement("option");
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  }
  topicSelect.value = "Surprise me";

  const locationInput = root.querySelector<HTMLInputElement>(".tp-location")!;
  const status = root.querySelector<HTMLDivElement>(".tp-status")!;
  const suggestion = root.querySelector<HTMLTextAreaElement>(".tp-suggestion")!;
  const count = root.querySelector<HTMLDivElement>(".tp-count")!;
  const primary = root.querySelector<HTMLButtonElement>(".tp-primary")!;
  const another = root.querySelector<HTMLButtonElement>(".tp-another")!;
  const dismiss = root.querySelector<HTMLButtonElement>(".tp-dismiss")!;
  const close = root.querySelector<HTMLButtonElement>(".tp-icon-button")!;
  const reopen = root.querySelector<HTMLButtonElement>(".tp-reopen")!;

  let composer: HTMLElement | null = null;
  let hasTweet = false;

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
      status.textContent = "Creating an idea…";
      callbacks.onGenerate(topicSelect.value as Topic, locationInput.value);
      return;
    }

    const tweet = suggestion.value.trim();
    if (!tweet) {
      hasTweet = false;
      primary.textContent = "Inspire Tweet";
      another.disabled = true;
      status.textContent = "Inspire a tweet first.";
      return;
    }

    const current = composerText(composer);
    if (current === tweet) {
      status.textContent =
        "Already in X. Edit it if you like, then use X's native Post button.";
      return;
    }

    status.textContent = "Adding to X…";
    void (async () => {
      const inserted = await replaceComposerText(composer, tweet);
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
    status.textContent = "Creating another idea…";
    callbacks.onGenerate(topicSelect.value as Topic, locationInput.value);
  });

  const invalidateSuggestion = (message: string) => {
    hasTweet = false;
    suggestion.value = "";
    updateCount();
    primary.textContent = "Inspire Tweet";
    primary.disabled = false;
    another.disabled = true;
    status.textContent = message;
  };

  topicSelect.addEventListener("change", () => {
    invalidateSuggestion("Topic changed. Press Inspire Tweet when you're ready.");
  });

  locationInput.addEventListener("change", () => {
    invalidateSuggestion(
      "Location changed. Press Inspire Tweet when you're ready."
    );
  });
  dismiss.addEventListener("click", callbacks.onDismiss);
  close.addEventListener("click", callbacks.onDismiss);
  reopen.addEventListener("click", callbacks.onReopen);

  return {
    element: root,
    setLoading(loading) {
      root.classList.toggle("tp-loading", loading);
      primary.disabled = loading;
      another.disabled = loading || !hasTweet;
      topicSelect.disabled = loading;
      locationInput.disabled = loading;
      if (loading) {
        status.textContent = "Thinking…";
      }
    },
    setTweet(tweet, resolvedTopic) {
      hasTweet = true;
      suggestion.value = tweet;
      updateCount();
      status.textContent = `Fresh idea for ${resolvedTopic}`;
      primary.textContent = "Use this";
      primary.disabled = false;
      another.textContent = "Change tweet";
      another.disabled = false;
    },
    setError(message) {
      hasTweet = false;
      root.classList.remove("tp-loading");
      status.textContent = message;
      primary.textContent = "Inspire Tweet";
      primary.disabled = false;
      another.disabled = true;
    },
    setVisible(visible) {
      root.classList.toggle("tp-inactive", !visible);
    },
    getTopic: () => topicSelect.value as Topic,
    getLocation: () => locationInput.value.trim(),
    getComposer: () => composer,
    setComposer: (value) => {
      if (value !== composer) {
        hasTweet = false;
        suggestion.value = "";
        updateCount();
        primary.textContent = "Inspire Tweet";
        another.textContent = "Change tweet";
        another.disabled = true;
        primary.disabled = false;
        status.textContent = "Press Inspire Tweet when you want an idea.";
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
      root.classList.toggle("tp-dismissed", dismissed);
    },
    getTweet: () => suggestion.value.trim()
  };
}
