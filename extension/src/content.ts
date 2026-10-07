import "./styles.css";
import { generateTweet } from "./api";
import { findComposer } from "./dom";
import { loadSettings, saveLocation } from "./settings";
import { resolveTopic } from "./topic";
import { createPanel } from "./ui";
import type { TopicSelection } from "./types";

let activeComposer: HTMLElement | null = null;
let lastResolvedTopic: string | undefined;
let dismissedForComposer: HTMLElement | null = null;
let generationSequence = 0;

const panel = createPanel({
  onGenerate: (topic, location) => {
    void generateSuggestion(topic, location);
  },
  onDismiss: () => {
    dismissedForComposer = activeComposer;
    panel.setDismissed(true);
  },
  onReopen: () => {
    dismissedForComposer = null;
    panel.setDismissed(false);
  }
});

async function generateSuggestion(
  selectedTopic: TopicSelection,
  location: string
): Promise<void> {
  if (!activeComposer) {
    return;
  }

  const requestId = ++generationSequence;
  const resolvedTopic = resolveTopic(selectedTopic, lastResolvedTopic);
  lastResolvedTopic = resolvedTopic;

  await saveLocation(location);
  panel.setLoading(true);

  try {
    const tweet = await generateTweet({
      topic: resolvedTopic,
      location: location.trim(),
      style: "thoughtful",
      maxLength: 140
    });

    if (requestId !== generationSequence || !activeComposer) {
      return;
    }

    panel.setTweet(tweet, resolvedTopic);
  } catch (error: unknown) {
    if (requestId !== generationSequence) {
      return;
    }

    panel.setError(
      error instanceof Error
        ? error.message
        : "Vichar could not generate a tweet."
    );
  } finally {
    if (requestId === generationSequence) {
      panel.setLoading(false);
    }
  }
}

async function handleComposer(composer: HTMLElement | null): Promise<void> {
  if (!composer) {
    generationSequence++;
    activeComposer = null;
    panel.setComposer(null);
    panel.setVisible(false);
    panel.setDismissed(false);
    return;
  }

  if (composer === activeComposer) {
    panel.setVisible(true);
    return;
  }

  activeComposer = composer;
  panel.setComposer(composer);
  panel.setVisible(true);
  panel.setDismissed(false);
  dismissedForComposer = null;
  lastResolvedTopic = undefined;

  const settings = await loadSettings();
  if (composer !== activeComposer) {
    return;
  }

  const locationInput =
    panel.element.querySelector<HTMLInputElement>(".vc-location");
  if (locationInput) {
    locationInput.value = settings.location;
  }

  // Deliberately do not generate here. Opening an X composer must not spend
  // OpenAI tokens unless the user explicitly asks for an idea.
}

let composerScanScheduled = false;

function observeComposer(): void {
  void handleComposer(findComposer());
}

function scheduleComposerScan(): void {
  if (composerScanScheduled) {
    return;
  }

  composerScanScheduled = true;
  window.requestAnimationFrame(() => {
    composerScanScheduled = false;
    observeComposer();
  });
}

const observer = new MutationObserver(() => {
  // X changes classes/styles very frequently while scrolling and rendering.
  // Watching all attribute mutations forces a full composer scan for each
  // change. Child-list changes are sufficient to detect composer creation and
  // removal, while the existing 1s safety poll covers state changes that do
  // not involve DOM insertion/removal.
  scheduleComposerScan();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true
});

window.setInterval(observeComposer, 1000);
observeComposer();
