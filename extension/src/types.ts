export const TOPICS = [
  "Technology & AI",
  "Photography",
  "Royal Enfield & Riding",
  "Travel & Exploration",
  "Life & Observations",
  "Surprise me"
] as const;

export type Topic = (typeof TOPICS)[number];
export type TopicSelection = Topic | string;

export interface GenerateRequest {
  topic: string;
  location?: string;
  style: string;
  maxLength: 140;
  useNews?: boolean;
}

export interface NewsSource {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
}

export interface GenerateResponse {
  tweet: string;
  mode?: "news" | "normal_fallback";
  fallbackReason?: "no_recent_news" | "news_unavailable";
  sources?: NewsSource[];
  remaining?: number | null;
  owner?: boolean;
  unlimited?: boolean;
}

export type BackgroundMessage =
  | { type: "generate"; request: GenerateRequest }
  | { type: "health" }
  | { type: "free-trial" }
  | { type: "activate-license"; licenseKey: string }
  | { type: "license-status" };

export interface LicenseStatus {
  active: boolean;
  owner: boolean;
  unlimited: boolean;
  balance: number | null;
}

export type BackgroundResponse =
  | { ok: true; tweet?: string; mode?: GenerateResponse["mode"]; fallbackReason?: GenerateResponse["fallbackReason"]; sources?: NewsSource[]; remaining?: number | null; owner?: boolean; unlimited?: boolean; licenseKey?: string; freeCredits?: number }
  | { ok: false; error: string };
