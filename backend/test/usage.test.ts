import { env } from "cloudflare:workers";
import { runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("VicharUsage Durable Object", () => {
  it("allows requests until the burst limit, then blocks the next request", async () => {
    const stub = env.VICHAR_USAGE.getByName("burst-boundary");
    const now = Date.UTC(2026, 9, 6, 10, 0, 10);

    expect(await stub.check(now, 10, 3)).toMatchObject({ allowed: true, remaining: 9, dailyLimit: 10 });
    expect(await stub.check(now + 1_000, 10, 3)).toMatchObject({ allowed: true, remaining: 8, dailyLimit: 10 });
    expect(await stub.check(now + 2_000, 10, 3)).toMatchObject({ allowed: true, remaining: 7, dailyLimit: 10 });

    const blocked = await stub.check(now + 3_000, 10, 3);
    expect(blocked).toMatchObject({ allowed: false, reason: "burst", remaining: 7, dailyLimit: 10 });
    if (blocked.allowed) throw new Error("expected burst limit to block");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks at the daily limit even when the burst window has reset", async () => {
    const stub = env.VICHAR_USAGE.getByName("daily-boundary");
    const dayStart = Date.UTC(2026, 9, 6, 11, 0, 0);

    for (let i = 0; i < 10; i++) {
      const result = await stub.check(dayStart + i * 60_000, 10, 100);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }

    const blocked = await stub.check(dayStart + 11 * 60_000, 10, 100);
    expect(blocked).toMatchObject({ allowed: false, reason: "daily", remaining: 0, dailyLimit: 10 });
    if (blocked.allowed) throw new Error("expected daily limit to block");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the daily counter on the next UTC day", async () => {
    const stub = env.VICHAR_USAGE.getByName("day-reset");
    const beforeMidnight = Date.UTC(2026, 9, 6, 23, 59, 59);
    const afterMidnight = Date.UTC(2026, 9, 7, 0, 0, 1);

    expect(await stub.check(beforeMidnight, 1, 10)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await stub.check(afterMidnight, 1, 10)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("keeps counters isolated by installation key", async () => {
    const a = env.VICHAR_USAGE.getByName("installation-a");
    const b = env.VICHAR_USAGE.getByName("installation-b");
    const now = Date.UTC(2026, 9, 6, 12, 0, 0);

    expect((await a.check(now, 1, 10)).allowed).toBe(true);
    expect((await a.check(now + 1_000, 1, 10)).allowed).toBe(false);
    expect((await b.check(now + 1_000, 1, 10)).allowed).toBe(true);
  });

  it("stores normalized topic events and returns aggregate-only analytics", async () => {
    const stub = env.VICHAR_USAGE.getByName("custom-topic-analytics");
    const now = Date.now();
    await stub.recordCustomTopicEvent({
      schemaVersion: 1, topic: "  Photography   Ideas ", language: "en",
      sourceApp: "vichar-web",
    });
    await stub.recordCustomTopicEvent({
      schemaVersion: 1, topic: "photography ideas", language: "ta",
      sourceApp: "future-app",
    });

    const analytics = await stub.getCustomTopicAnalytics(now + 2);
    expect(analytics.totalEvents).toBe(2);
    expect(analytics.uniqueTopicCount).toBe(1);
    expect(analytics.topTopics).toEqual(analytics.topics.slice(0, 10));
    expect(analytics.windowDays).toBe(90);
    expect(analytics.topics).toEqual([{
      topic: "photography ideas", count: 2,
      languages: expect.arrayContaining(["en", "ta"]),
      sourceApps: expect.arrayContaining(["vichar-web", "future-app"]),
    }]);
    expect(analytics.languages).toEqual(expect.arrayContaining([
      { language: "en", count: 1 }, { language: "ta", count: 1 },
    ]));
    expect(analytics.sourceApps).toEqual(expect.arrayContaining([
      { sourceApp: "vichar-web", count: 1 }, { sourceApp: "future-app", count: 1 },
    ]));
    expect(JSON.stringify(analytics)).not.toMatch(/created_at|session|licenseKey|ipAddress/i);
  });

  it("reports unique topic totals and ranks only the top ten topics", async () => {
    const stub = env.VICHAR_USAGE.getByName("custom-topic-analytics-top-ten");
    for (let i = 0; i < 12; i++) {
      await stub.recordCustomTopicEvent({
        schemaVersion: 1, topic: `topic-${String(i).padStart(2, "0")}`, language: "en",
        sourceApp: "vichar-web",
      });
    }
    await stub.recordCustomTopicEvent({
      schemaVersion: 1, topic: "topic-00", language: "en",
      sourceApp: "vichar-web",
    });

    const analytics = await stub.getCustomTopicAnalytics();
    expect(analytics.totalEvents).toBe(13);
    expect(analytics.uniqueTopicCount).toBe(12);
    expect(analytics.topTopics).toHaveLength(10);
    expect(analytics.topTopics[0]).toMatchObject({ topic: "topic-00", count: 2 });
    expect(analytics.topics).toHaveLength(12);
  });

  it("physically removes expired topic events when the Durable Object alarm runs", async () => {
    const stub = env.VICHAR_USAGE.getByName("custom-topic-analytics-alarm-retention");
    await stub.recordCustomTopicEvent({
      schemaVersion: 1, topic: "alarm retention topic", language: "en",
      sourceApp: "vichar-web",
    });

    // Make the row older than the retention window without exposing a production RPC method.
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE custom_topic_events SET created_at = ?",
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );
    });

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const remainingRows = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.sql.exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM custom_topic_events",
      ).toArray()[0]?.count ?? 0,
    );
    expect(remainingRows).toBe(0);
    expect(await runDurableObjectAlarm(stub)).toBe(false);
  });

  it("excludes and deletes topic events outside the 90-day analytics window", async () => {
    const stub = env.VICHAR_USAGE.getByName("custom-topic-analytics-retention");
    const now = Date.now();
    await stub.recordCustomTopicEvent({
      schemaVersion: 1, topic: "temporary topic", language: "en",
      sourceApp: "vichar-web",
    });
    const expired = await stub.getCustomTopicAnalytics(now + 91 * 24 * 60 * 60 * 1000);
    expect(expired.totalEvents).toBe(0);
    expect(expired.topics).toEqual([]);
  });

  it("creates a license once without resetting its balance", async () => {
    const stub = env.VICHAR_USAGE.getByName("license-create-once");
    expect(await stub.createLicense(50, 1_000)).toEqual({ created: true, balance: 50 });
    expect(await stub.createLicense(50, 2_000)).toEqual({ created: false, balance: 50 });
    expect(await stub.getLicense()).toEqual({ balance: 50, createdAt: 1_000, updatedAt: 1_000, attributionRequired: false });
  });

  it("adds purchased credits and consumes them atomically without going negative", async () => {
    const stub = env.VICHAR_USAGE.getByName("license-balance-boundary");
    await stub.createLicense(1, 1_000);
    expect(await stub.addCredits(4, 2_000)).toBe(5);
    expect(await stub.consumeCredit(3_000)).toEqual({ consumed: true, balance: 4 });
    expect(await stub.consumeCredit(4_000)).toEqual({ consumed: true, balance: 3 });
  });

  it("rejects credit consumption when the balance is empty", async () => {
    const stub = env.VICHAR_USAGE.getByName("license-empty");
    await stub.createLicense(0, 1_000);
    expect(await stub.consumeCredit(2_000)).toEqual({ consumed: false, balance: 0 });
    expect((await stub.getLicense())?.balance).toBe(0);
  });

  it("does not create a missing license when adding or consuming credits", async () => {
    const stub = env.VICHAR_USAGE.getByName("license-missing");
    expect(await stub.addCredits(10)).toBeNull();
    expect(await stub.consumeCredit()).toEqual({ consumed: false, balance: null });
    expect(await stub.getLicense()).toBeNull();
  });
});
