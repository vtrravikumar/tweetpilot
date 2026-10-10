import { DEFAULT_MAX_LENGTH, PANEL_ID } from "./constants";
import { TOPICS, type GenerateResponse, type TopicSelection } from "./types";
import {
  composerHost,
  composerToolbar,
  composerText,
  copyTextToClipboard,
  isPostButtonEnabled,
  replaceComposerText
} from "./dom";

export interface PanelCallbacks {
  onGenerate: (topic: TopicSelection, location: string, useNews: boolean) => void;
  onFreeTrial: () => void;
  onActivate: (licenseKey: string) => void;
  onDismiss: () => void;
  onReopen: () => void;
}

export interface TweetPanel {
  element: HTMLDivElement;
  setLoading: (loading: boolean) => void;
  setTweet: (result: GenerateResponse, resolvedTopic: string, remaining?: number | null, owner?: boolean) => void;
  setLicense: (remaining: number | null, owner: boolean, message?: string) => void;
  setError: (message: string) => void;
  setVisible: (visible: boolean) => void;
  getTopic: () => TopicSelection;
  getLocation: () => string;
  getUseNews: () => boolean;
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

      <div class="vc-license">
        <div class="vc-license-status" aria-live="polite">Extension access: activate a license or claim your free trial.</div>
        <div class="vc-license-actions">
          <button type="button" class="vc-secondary vc-free-trial">Get 50 free generations</button>
        </div>
        <div class="vc-license-activate">
          <input class="vc-license-key" type="password" autocomplete="off" spellcheck="false" aria-label="Vichar license key" placeholder="Paste license key" />
          <button type="button" class="vc-secondary vc-activate">Activate</button>
        </div>
      </div>

      <div class="vc-controls">
        <label>
          <span>Topic</span>
          <select class="vc-topic" aria-label="Topic">
            ${TOPICS.map((topic) => `<option value="${topic}">${topic}</option>`).join("")}
          </select>

        </label>
        <label>
          <span>Location <em>optional · worldwide</em></span>
          <input class="vc-location" type="text" maxlength="80" placeholder="e.g. Tokyo or Chennai" />
        </label>
      </div>

      <label class="vc-news-toggle">
        <input class="vc-use-news" type="checkbox" />
        <span>Use recent news <em>last 48 hours</em></span>
      </label>

      <div class="vc-status" aria-live="polite"></div>
      <div class="vc-news-sources" aria-label="News sources"></div>

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

  const licenseStatus = root.querySelector<HTMLDivElement>(".vc-license-status")!;
  const licenseActions = root.querySelector<HTMLDivElement>(".vc-license-actions")!;
  const licenseActivate = root.querySelector<HTMLDivElement>(".vc-license-activate")!;
  const freeTrial = root.querySelector<HTMLButtonElement>(".vc-free-trial")!;
  const licenseKeyInput = root.querySelector<HTMLInputElement>(".vc-license-key")!;
  const activateButton = root.querySelector<HTMLButtonElement>(".vc-activate")!;
  const topicInput = root.querySelector<HTMLSelectElement>(".vc-topic")!;
  topicInput.value = "Surprise me";

  const getSelectedTopic = () => topicInput.value.trim() || "Surprise me";

  const locationInput = root.querySelector<HTMLInputElement>(".vc-location")!;
  const status = root.querySelector<HTMLDivElement>(".vc-status")!;
  const newsToggle = root.querySelector<HTMLInputElement>(".vc-use-news")!;
  const newsSources = root.querySelector<HTMLDivElement>(".vc-news-sources")!;
  const suggestion = root.querySelector<HTMLTextAreaElement>(".vc-suggestion")!;
  const count = root.querySelector<HTMLDivElement>(".vc-count")!;
  const primary = root.querySelector<HTMLButtonElement>(".vc-primary")!;
  const another = root.querySelector<HTMLButtonElement>(".vc-another")!;
  const dismiss = root.querySelector<HTMLButtonElement>(".vc-dismiss")!;
  const close = root.querySelector<HTMLButtonElement>(".vc-icon-button")!;
  const reopen = root.querySelector<HTMLButtonElement>(".vc-reopen")!;

  let composer: HTMLElement | null = null;
  let hasTweet = false;
  let replaceConfirmedForDraft: string | null = null;

  const updateCount = () => {
    count.textContent = `${suggestion.value.length}/${DEFAULT_MAX_LENGTH}`;
  };

  const clearNewsSources = () => newsSources.replaceChildren();

  const renderNewsSources = (sources: NonNullable<GenerateResponse["sources"]> = []) => {
    clearNewsSources();
    if (sources.length === 0) return;
    const heading = document.createElement("div");
    heading.className = "vc-news-heading";
    heading.textContent = "Recent sources";
    newsSources.appendChild(heading);
    for (const source of sources) {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:") continue;
        const link = document.createElement("a");
        link.href = url.toString();
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.publisher + ": " + source.title;
        newsSources.appendChild(link);
        const published = new Date(source.publishedAt);
        if (Number.isFinite(published.getTime())) {
          const time = document.createElement("span");
          time.className = "vc-news-time";
          time.textContent = published.toLocaleString();
          newsSources.appendChild(time);
        }
      } catch {
        // Ignore malformed source metadata rather than rendering an unsafe link.
      }
    }
  };

  freeTrial.addEventListener("click", () => {
    freeTrial.disabled = true;
    activateButton.disabled = true;
    licenseStatus.textContent = "Requesting your free trial…";
    callbacks.onFreeTrial();
  });

  activateButton.addEventListener("click", () => {
    const key = licenseKeyInput.value.trim();
    if (!key) {
      licenseStatus.textContent = "Paste your Vichar license key first.";
      return;
    }
    freeTrial.disabled = true;
    activateButton.disabled = true;
    licenseStatus.textContent = "Activating license…";
    callbacks.onActivate(key);
  });

  licenseKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") activateButton.click();
  });

  suggestion.addEventListener("input", updateCount);

  primary.addEventListener("click", () => {
    if (!composer) {
      status.textContent = "Open the X composer first.";
      return;
    }

    if (!hasTweet) {
      status.textContent = "Vichāraṁ Labhatām… · Get a thought…";
      callbacks.onGenerate(getSelectedTopic(), locationInput.value, newsToggle.checked);
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
      replaceConfirmedForDraft = null;
      status.textContent =
        "Already in X. Edit it if you like, then use X's native Post button.";
      return;
    }

    if (current) {
      if (replaceConfirmedForDraft !== current) {
        replaceConfirmedForDraft = current;
        primary.textContent = "Replace draft?";
        status.textContent =
          "X already has a draft. Choose Replace draft? to prepare a safe manual replacement.";
        return;
      }

      status.textContent = "Copying Vichar to your clipboard…";
      void (async () => {
        const copied = await copyTextToClipboard(tweet);
        replaceConfirmedForDraft = null;
        composer.focus();

        if (!copied) {
          primary.textContent = "Copy & replace manually";
          status.textContent =
            "Vichar could not be copied automatically. Select the X draft and paste the Vichar manually.";
          return;
        }

        primary.textContent = "Copy again";
        status.textContent =
          "Vichar copied. In X, press Cmd/Ctrl+A, then Cmd/Ctrl+V to replace your draft.";
      })();
      return;
    }

    status.textContent = "Adding to X…";
    void (async () => {
      const inserted = await replaceComposerText(composer, tweet);
      replaceConfirmedForDraft = null;
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
    callbacks.onGenerate(getSelectedTopic(), locationInput.value, newsToggle.checked);
  });

  const invalidateSuggestion = (message: string) => {
    hasTweet = false;
    replaceConfirmedForDraft = null;
    suggestion.value = "";
    updateCount();
    primary.textContent = "Get a thought";
    primary.disabled = false;
    another.disabled = true;
    status.textContent = message;
    clearNewsSources();
  };

  topicInput.addEventListener("change", () => {
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
      newsToggle.disabled = loading;
      if (loading) {
        clearNewsSources();
        status.textContent = "Vichāraḥ Sṛjyate… · Creating a thought…";
      }
    },
    setLicense(remaining, owner, message) {
      freeTrial.disabled = false;
      activateButton.disabled = false;
      const active = owner || typeof remaining === "number";
      licenseActions.style.display = active ? "none" : "";
      licenseActivate.style.display = active ? "none" : "";
      if (owner) {
        licenseStatus.textContent = message || "Owner access · Unlimited generations";
      } else if (typeof remaining === "number" && remaining === 0) {
        licenseStatus.textContent = "No generations remaining · Credit top-ups are not available yet.";
      } else if (typeof remaining === "number" && remaining <= 10) {
        licenseStatus.textContent = `Low balance · ${remaining.toLocaleString()} generations remaining`;
      } else if (typeof remaining === "number") {
        licenseStatus.textContent = `Extension balance · ${remaining.toLocaleString()} generations remaining`;
      } else {
        licenseStatus.textContent = message || "Extension access: activate a license or claim your free trial.";
      }
    },
    setTweet(result, resolvedTopic, remaining, owner) {
      hasTweet = true;
      replaceConfirmedForDraft = null;
      if (owner || typeof remaining === "number") {
        this.setLicense(remaining ?? null, owner === true);
      }
      suggestion.value = result.tweet;
      updateCount();
      if (result.mode === "news") {
        status.textContent = "News-based Vichar · " + resolvedTopic;
        renderNewsSources(result.sources);
      } else if (result.fallbackReason === "no_recent_news") {
        status.textContent = "No recent news found for this topic. A normal Vichar was generated instead.";
        clearNewsSources();
      } else if (result.fallbackReason === "news_unavailable") {
        status.textContent = "News retrieval was unavailable. This is a normal Vichar instead.";
        clearNewsSources();
      } else {
        status.textContent = "Vichāraḥ · " + resolvedTopic + " · Thought";
        clearNewsSources();
      }
      primary.textContent = "Use this";
      primary.disabled = false;
      another.textContent = "Another thought";
      another.disabled = false;
    },
    setError(message) {
      hasTweet = false;
      replaceConfirmedForDraft = null;
      root.classList.remove("vc-loading");
      status.textContent = message;
      clearNewsSources();
      primary.textContent = "Get a thought";
      primary.disabled = false;
      another.disabled = true;
    },
    setVisible(visible) {
      root.classList.toggle("vc-inactive", !visible);
    },
    getTopic: () => getSelectedTopic() as TopicSelection,
    getLocation: () => locationInput.value.trim(),
    getUseNews: () => newsToggle.checked,
    getComposer: () => composer,
    setComposer: (value) => {
      if (value !== composer) {
        hasTweet = false;
        replaceConfirmedForDraft = null;
        suggestion.value = "";
        updateCount();
        clearNewsSources();
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
