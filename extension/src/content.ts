import "./styles.css";
import { generateTweet } from "./api";
import { findComposer } from "./dom";
import { resolveTopic } from "./topic";
import { createPanel } from "./ui";
import type { TopicSelection } from "./types";

let activeComposer: HTMLElement | null = null;
let lastResolvedTopic: string | undefined;
let dismissedForComposer: HTMLElement | null = null;
let generationSequence = 0;

const panel = createPanel({
  onGenerate: (topic, location, useNews) => {
    void generateSuggestion(topic, location, useNews);
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

const VICHAR_STYLES = [
  "thoughtful",
  "conversational",
  "witty",
  "observational",
  "curious",
  "provocative",
  "inspirational",
  "minimalist"
] as const;

type VicharStyle = (typeof VICHAR_STYLES)[number];

function pickRandomStyle(): VicharStyle {
  return VICHAR_STYLES[Math.floor(Math.random() * VICHAR_STYLES.length)];
}

async function generateSuggestion(
  selectedTopic: TopicSelection,
  location: string,
  useNews: boolean
): Promise<void> {
  if (!activeComposer) {
    return;
  }

  const requestId = ++generationSequence;
  const resolvedTopic = resolveTopic(selectedTopic, lastResolvedTopic);
  lastResolvedTopic = resolvedTopic;

  panel.setLoading(true);

  try {
    const result = await generateTweet({
      topic: resolvedTopic,
      location: location.trim(),
      style: pickRandomStyle(),
      maxLength: 140,
      useNews
    });

    if (requestId !== generationSequence || !activeComposer) {
      return;
    }

    panel.setTweet(result, resolvedTopic);
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
