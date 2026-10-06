import "./styles.css";
import { generateTweet } from "./api";
import { findComposer } from "./dom";
import { loadSettings, saveLocation } from "./settings";
import { resolveTopic } from "./topic";
import { createPanel } from "./ui";
import type { Topic } from "./types";

let activeComposer: HTMLElement | null = null;
let lastResolvedTopic: Exclude<Topic, "Surprise me"> | undefined;
let lastGeneratedForComposer: HTMLElement | null = null;
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
    void generateSuggestion(panel.getTopic(), panel.getLocation());
  }
});

async function generateSuggestion(
  selectedTopic: Topic,
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
        : "TweetPilot could not generate a suggestion."
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
    panel.element.querySelector<HTMLInputElement>(".tp-location");
  if (locationInput) {
    locationInput.value = settings.location;
  }

  if (lastGeneratedForComposer !== composer) {
    lastGeneratedForComposer = composer;
    void generateSuggestion("Surprise me", settings.location);
  }
}

function observeComposer(): void {
  void handleComposer(findComposer());
}

const observer = new MutationObserver(() => {
  observeComposer();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["aria-hidden", "style", "class"]
});

window.setInterval(observeComposer, 1000);
observeComposer();
