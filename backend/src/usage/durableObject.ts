import { DurableObject } from "cloudflare:workers";

export type UsageDecision =
  | {
      allowed: true;
      remaining: number;
      dailyLimit: number;
    }
  | {
      allowed: false;
      remaining: number;
      dailyLimit: number;
      retryAfterSeconds?: number;
      reason: "daily" | "burst" | "unauthorized";
    };

export interface LicenseBalance {
  balance: number;
  createdAt: number;
  updatedAt: number;
}

export interface LicenseCreation {
  created: boolean;
  balance: number;
}

/**
 * A strongly-consistent Durable Object for one Vichar usage identity.
 *
 * The namespace object name must be derived server-side from an installation
 * identifier or a hash of a license key. Never use a plaintext license key as
 * the object name. The database stores counters and credit balances only; it
 * does not store tweet text or user profile data.
 */
export class VicharUsage extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS usage (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          day TEXT NOT NULL,
          day_count INTEGER NOT NULL DEFAULT 0,
          minute INTEGER NOT NULL,
          minute_count INTEGER NOT NULL DEFAULT 0
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS licenses (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          balance INTEGER NOT NULL CHECK (balance >= 0),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    });
  }

  async check(
    nowMs: number,
    dailyLimit: number,
    burstLimit: number,
  ): Promise<UsageDecision> {
    const now = new Date(nowMs);
    const day = now.toISOString().slice(0, 10);
    const minute = Math.floor(nowMs / 60_000);

    const row = this.ctx.storage.sql
      .exec<{
        day: string;
        day_count: number;
        minute: number;
        minute_count: number;
      }>("SELECT day, day_count, minute, minute_count FROM usage WHERE id = 1")
      .toArray()[0];

    let dayCount = row?.day_count ?? 0;
    let minuteCount = row?.minute_count ?? 0;

    if (!row || row.day !== day) dayCount = 0;
    if (!row || row.minute !== minute) minuteCount = 0;

    if (dayCount >= dailyLimit) {
      return {
        allowed: false,
        remaining: 0,
        dailyLimit,
        retryAfterSeconds: secondsUntilNextUtcDay(nowMs),
        reason: "daily",
      };
    }

    if (minuteCount >= burstLimit) {
      return {
        allowed: false,
        remaining: Math.max(0, dailyLimit - dayCount),
        dailyLimit,
        retryAfterSeconds: secondsUntilNextMinute(nowMs),
        reason: "burst",
      };
    }

    dayCount += 1;
    minuteCount += 1;

    this.ctx.storage.sql.exec(
      `
        INSERT INTO usage (id, day, day_count, minute, minute_count)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          day = excluded.day,
          day_count = excluded.day_count,
          minute = excluded.minute,
          minute_count = excluded.minute_count
      `,
      day,
      dayCount,
      minute,
      minuteCount,
    );

    return {
      allowed: true,
      remaining: Math.max(0, dailyLimit - dayCount),
      dailyLimit,
    };
  }

  /** Create a license once. Repeated calls never reset an existing balance. */
  async createLicense(initialCredits: number, nowMs = Date.now()): Promise<LicenseCreation> {
    if (!Number.isSafeInteger(initialCredits) || initialCredits < 0) {
      throw new Error("initialCredits must be a non-negative safe integer.");
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO licenses (id, balance, created_at, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      initialCredits,
      nowMs,
      nowMs,
    );

    const changes = this.ctx.storage.sql
      .exec<{ changes: number }>("SELECT changes() AS changes")
      .toArray()[0]?.changes ?? 0;
    const license = this.getLicense();
    if (!license) throw new Error("License creation did not persist.");
    return { created: changes === 1, balance: license.balance };
  }

  getLicense(): LicenseBalance | null {
    const row = this.ctx.storage.sql
      .exec<{ balance: number; created_at: number; updated_at: number }>(
        "SELECT balance, created_at, updated_at FROM licenses WHERE id = 1",
      )
      .toArray()[0];

    if (!row) return null;
    return { balance: row.balance, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  /** Atomically add purchased credits after verified, idempotent fulfilment. */
  async addCredits(amount: number, nowMs = Date.now()): Promise<number | null> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("amount must be a positive safe integer.");
    }

    this.ctx.storage.sql.exec(
      "UPDATE licenses SET balance = balance + ?, updated_at = ? WHERE id = 1",
      amount,
      nowMs,
    );
    return this.getLicense()?.balance ?? null;
  }

  /** Atomically consume one credit; a balance can never become negative. */
  async consumeCredit(nowMs = Date.now()): Promise<{ consumed: boolean; balance: number | null }> {
    const updated = this.ctx.storage.sql
      .exec<{ balance: number }>(
        "UPDATE licenses SET balance = balance - 1, updated_at = ? WHERE id = 1 AND balance > 0 RETURNING balance",
        nowMs,
      )
      .toArray()[0];

    if (updated) return { consumed: true, balance: updated.balance };
    return { consumed: false, balance: this.getLicense()?.balance ?? null };
  }
}

function secondsUntilNextMinute(nowMs: number): number {
  return Math.max(1, Math.ceil((60_000 - (nowMs % 60_000)) / 1000));
}

function secondsUntilNextUtcDay(nowMs: number): number {
  const now = new Date(nowMs);
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - nowMs) / 1000));
}
