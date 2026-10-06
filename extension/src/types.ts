export const TOPICS = [
  "Technology & AI",
  "Photography",
  "Royal Enfield & Riding",
  "Travel & Exploration",
  "Life & Observations",
  "Surprise me"
] as const;

export type Topic = (typeof TOPICS)[number];

export interface GenerateRequest {
  topic: Exclude<Topic, "Surprise me">;
  location?: string;
  style: "thoughtful";
  maxLength: 140;
}

export interface GenerateResponse {
  tweet: string;
}

export interface StoredSettings {
  location: string;
}

export type BackgroundMessage =
  | { type: "generate"; request: GenerateRequest }
  | { type: "health" };

export type BackgroundResponse =
  | { ok: true; tweet: string }
  | { ok: false; error: string };
