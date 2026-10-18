import { env } from "cloudflare:workers";
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

  it("reserves image credits once for an idempotent operation ID", async () => {
    const stub = env.VICHAR_USAGE.getByName("image-reserve-idempotent");
    await stub.createLicense(10, 1_000);
    expect(await stub.reserveImageCredits("op-1", 4, 2_000)).toEqual({
      reserved: true, status: "reserved", balance: 6, created: false, created: true,
    });
    // A retry must not deduct the same reservation twice.
    expect(await stub.reserveImageCredits("op-1", 4, 3_000)).toEqual({
      reserved: true, status: "reserved", balance: 6,
    });
    expect(await stub.reserveImageCredits("op-1", 5, 4_000)).toEqual({
      reserved: false, status: "operation_conflict", balance: 6, created: false,
    });
    expect((await stub.getLicense())?.balance).toBe(6);
  });

  it("does not reserve image credits without enough balance or a license", async () => {
    const empty = env.VICHAR_USAGE.getByName("image-reserve-insufficient");
    await empty.createLicense(3, 1_000);
    expect(await empty.reserveImageCredits("op-too-large", 4, 2_000)).toEqual({
      reserved: false, status: "insufficient", balance: 3, created: false,
    });
    const missing = env.VICHAR_USAGE.getByName("image-reserve-missing-license");
    expect(await missing.reserveImageCredits("op-no-license", 1, 2_000)).toEqual({
      reserved: false, status: "missing_license", balance: null, created: false,
    });
  });

  it("releases reserved image credits once after a confirmed failure", async () => {
    const stub = env.VICHAR_USAGE.getByName("image-reserve-release");
    await stub.createLicense(8, 1_000);
    await stub.reserveImageCredits("op-release", 5, 2_000);
    expect(await stub.releaseImageCredits("op-release", 3_000)).toEqual({ released: true, balance: 8 });
    // Repeating release cannot refund twice.
    expect(await stub.releaseImageCredits("op-release", 4_000)).toEqual({ released: true, balance: 8 });
    expect(await stub.reserveImageCredits("op-release", 5, 5_000)).toEqual({
      reserved: false, status: "released", balance: 8, created: false,
    });
  });

  it("commits successful image credits and prevents a later release", async () => {
    const stub = env.VICHAR_USAGE.getByName("image-reserve-commit");
    await stub.createLicense(8, 1_000);
    await stub.reserveImageCredits("op-commit", 5, 2_000);
    expect(await stub.startImageGeneration("op-commit", 2_500)).toEqual({ started: true, status: "processing" });
    expect(await stub.commitImageCredits("op-commit", 3_000)).toBe(true);
    expect(await stub.commitImageCredits("op-commit", 4_000)).toBe(true);
    expect(await stub.releaseImageCredits("op-commit", 5_000)).toEqual({ released: false, balance: 3 });
    expect((await stub.getLicense())?.balance).toBe(3);
  });

  it("claims provider execution once and never automatically refunds an unknown outcome", async () => {
    const stub = env.VICHAR_USAGE.getByName("image-reserve-unknown");
    await stub.createLicense(9, 1_000);
    expect(await stub.reserveImageCredits("op-unknown", 5, 2_000)).toMatchObject({
      reserved: true, status: "reserved", balance: 4, created: true,
    });
    expect(await stub.startImageGeneration("op-unknown", 2_100)).toEqual({ started: true, status: "processing" });
    // A duplicate request cannot claim the same provider operation again.
    expect(await stub.startImageGeneration("op-unknown", 2_200)).toEqual({ started: false, status: "processing" });
    expect(await stub.markImageGenerationUnknown("op-unknown", 3_000)).toBe(true);
    expect(await stub.startImageGeneration("op-unknown", 4_000)).toEqual({ started: false, status: "unknown" });
    // An ambiguous timeout is not proof of failure, so no automatic refund.
    expect(await stub.releaseImageCredits("op-unknown", 5_000)).toEqual({ released: false, balance: 4 });
    // Reconciliation can confirm success and commit the held credits.
    expect(await stub.commitImageCredits("op-unknown", 6_000)).toBe(true);
    expect(await stub.commitImageCredits("op-unknown", 7_000)).toBe(true);
    expect((await stub.getLicense())?.balance).toBe(4);
  });

  it("does not overspend when image reservations race", async () => {
    const stub = env.VICHAR_USAGE.getByName("image-reserve-race");
    await stub.createLicense(5, 1_000);
    const results = await Promise.all([
      stub.reserveImageCredits("race-a", 4, 2_000),
      stub.reserveImageCredits("race-b", 4, 2_000),
    ]);
    expect(results.filter((result) => result.reserved)).toHaveLength(1);
    expect((await stub.getLicense())?.balance).toBe(1);
  });
});
