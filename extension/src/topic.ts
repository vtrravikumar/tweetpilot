import { TOPICS, type Topic } from "./types";

export function resolveTopic(
  selected: string,
  previousResolved?: string
): string {
  if (selected !== "Surprise me") {
    return selected;
  }

  const candidates = TOPICS.filter(
    (topic): topic is Exclude<Topic, "Surprise me"> =>
      topic !== "Surprise me" && topic !== previousResolved
  );

  return (
    candidates[Math.floor(Math.random() * candidates.length)] ??
    "Life & Observations"
  );
}
