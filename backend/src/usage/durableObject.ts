import { DurableObject } from "cloudflare:workers";

export type UsageDecision =
  | { allowed: true; remaining: number; dailyLimit: number }
  | { allowed: false; remaining: number; dailyLimit: number; retryAfterSeconds?: number; reason: "daily" | "burst" | "unauthorized" };

export interface LicenseBalance {
  balance: number;
  createdAt: number;
  updatedAt: number;
  attributionRequired: boolean;
}

export interface LicenseCreation { created: boolean; balance: number }
export interface PaymentLinkRecord { id: string; credits: number; amount: number; status: "created" | "paid"; createdAt: number; paidAt: number | null }
export interface PaymentFulfilment { fulfilled: boolean; balance: number | null }

export class VicharUsage extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS usage (
          id INTEGER PRIMARY KEY CHECK (id = 1), day TEXT NOT NULL, day_count INTEGER NOT NULL DEFAULT 0,
          minute INTEGER NOT NULL, minute_count INTEGER NOT NULL DEFAULT 0
        )`);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS licenses (
          id INTEGER PRIMARY KEY CHECK (id = 1), balance INTEGER NOT NULL CHECK (balance >= 0),
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )`);
      try { this.ctx.storage.sql.exec("ALTER TABLE licenses ADD COLUMN attribution_required INTEGER NOT NULL DEFAULT 0"); } catch { /* Already exists. */ }
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS trial_claims (
          id INTEGER PRIMARY KEY CHECK (id = 1), day TEXT NOT NULL,
          claim_count INTEGER NOT NULL CHECK (claim_count >= 0)
        )`);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS payment_links (
          id TEXT PRIMARY KEY, credits INTEGER NOT NULL CHECK (credits > 0),
          amount INTEGER NOT NULL CHECK (amount > 0), status TEXT NOT NULL DEFAULT 'created',
          created_at INTEGER NOT NULL, paid_at INTEGER
        )`);
    });
  }

  async check(nowMs: number, dailyLimit: number, burstLimit: number): Promise<UsageDecision> {
    const now = new Date(nowMs), day = now.toISOString().slice(0, 10), minute = Math.floor(nowMs / 60_000);
    const row = this.ctx.storage.sql.exec<{ day: string; day_count: number; minute: number; minute_count: number }>("SELECT day, day_count, minute, minute_count FROM usage WHERE id = 1").toArray()[0];
    let dayCount = row?.day_count ?? 0, minuteCount = row?.minute_count ?? 0;
    if (!row || row.day !== day) dayCount = 0;
    if (!row || row.minute !== minute) minuteCount = 0;
    if (dayCount >= dailyLimit) return { allowed: false, remaining: 0, dailyLimit, retryAfterSeconds: secondsUntilNextUtcDay(nowMs), reason: "daily" };
    if (minuteCount >= burstLimit) return { allowed: false, remaining: Math.max(0, dailyLimit - dayCount), dailyLimit, retryAfterSeconds: secondsUntilNextMinute(nowMs), reason: "burst" };
    dayCount++; minuteCount++;
    this.ctx.storage.sql.exec(`INSERT INTO usage (id, day, day_count, minute, minute_count) VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET day=excluded.day, day_count=excluded.day_count, minute=excluded.minute, minute_count=excluded.minute_count`, day, dayCount, minute, minuteCount);
    return { allowed: true, remaining: Math.max(0, dailyLimit - dayCount), dailyLimit };
  }

  async claimFreeTrial(day: string): Promise<boolean> {
    const row = this.ctx.storage.sql.exec<{ day: string; claim_count: number }>("SELECT day, claim_count FROM trial_claims WHERE id = 1").toArray()[0];
    if (row?.day === day && row.claim_count >= 1) return false;
    const count = row?.day === day ? row.claim_count + 1 : 1;
    this.ctx.storage.sql.exec("INSERT INTO trial_claims (id, day, claim_count) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET day=excluded.day, claim_count=excluded.claim_count", day, count);
    return true;
  }

  async checkBurst(nowMs: number, burstLimit: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const minute = Math.floor(nowMs / 60_000);
    const row = this.ctx.storage.sql.exec<{ day: string; day_count: number; minute: number; minute_count: number }>("SELECT day, day_count, minute, minute_count FROM usage WHERE id = 1").toArray()[0];
    const count = !row || row.minute !== minute ? 0 : row.minute_count;
    if (count >= burstLimit) return { allowed: false, retryAfterSeconds: secondsUntilNextMinute(nowMs) };
    const day = new Date(nowMs).toISOString().slice(0, 10), dayCount = !row || row.day !== day ? 0 : row.day_count;
    this.ctx.storage.sql.exec("INSERT INTO usage (id, day, day_count, minute, minute_count) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET day=excluded.day, day_count=excluded.day_count, minute=excluded.minute, minute_count=excluded.minute_count", day, dayCount, minute, count + 1);
    return { allowed: true };
  }

  async createLicense(initialCredits: number, nowMs = Date.now(), attributionRequired = false): Promise<LicenseCreation> {
    if (!Number.isSafeInteger(initialCredits) || initialCredits < 0) throw new Error("initialCredits must be a non-negative safe integer.");
    this.ctx.storage.sql.exec("INSERT INTO licenses (id, balance, created_at, updated_at, attribution_required) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING", initialCredits, nowMs, nowMs, attributionRequired ? 1 : 0);
    const changes = this.ctx.storage.sql.exec<{ changes: number }>("SELECT changes() AS changes").toArray()[0]?.changes ?? 0;
    const license = this.getLicense();
    if (!license) throw new Error("License creation did not persist.");
    return { created: changes === 1, balance: license.balance };
  }

  getLicense(): LicenseBalance | null {
    const row = this.ctx.storage.sql.exec<{ balance: number; created_at: number; updated_at: number; attribution_required: number }>("SELECT balance, created_at, updated_at, attribution_required FROM licenses WHERE id = 1").toArray()[0];
    return row ? { balance: row.balance, createdAt: row.created_at, updatedAt: row.updated_at, attributionRequired: row.attribution_required === 1 } : null;
  }

  async addCredits(amount: number, nowMs = Date.now()): Promise<number | null> {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive safe integer.");
    this.ctx.storage.sql.exec("UPDATE licenses SET balance = balance + ?, updated_at = ? WHERE id = 1", amount, nowMs);
    return this.getLicense()?.balance ?? null;
  }

  /** Record a Razorpay payment link before exposing it to the extension. */
  async registerPaymentLink(id: string, credits: number, amount: number, nowMs = Date.now()): Promise<boolean> {
    if (!id || !Number.isSafeInteger(credits) || credits <= 0 || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid payment link record.");
    this.ctx.storage.sql.exec("INSERT INTO payment_links (id, credits, amount, status, created_at, paid_at) VALUES (?, ?, ?, 'created', ?, NULL) ON CONFLICT(id) DO NOTHING", id, credits, amount, nowMs);
    const row = this.getPaymentLink(id);
    return Boolean(row && row.credits === credits && row.amount === amount);
  }

  getPaymentLink(id: string): PaymentLinkRecord | null {
    const row = this.ctx.storage.sql.exec<{ id: string; credits: number; amount: number; status: string; created_at: number; paid_at: number | null }>("SELECT id, credits, amount, status, created_at, paid_at FROM payment_links WHERE id = ?", id).toArray()[0];
    if (!row || (row.status !== "created" && row.status !== "paid")) return null;
    return { id: row.id, credits: row.credits, amount: row.amount, status: row.status, createdAt: row.created_at, paidAt: row.paid_at };
  }

  /** Exactly-once crediting: duplicate webhook/poll calls cannot add credits twice. */
  async fulfilPaymentLink(id: string, paidAmount: number, nowMs = Date.now()): Promise<PaymentFulfilment> {
    const result = this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql.exec<{ credits: number; amount: number; status: string }>("SELECT credits, amount, status FROM payment_links WHERE id = ?", id).toArray()[0];
      if (!row || row.amount !== paidAmount || !Number.isSafeInteger(paidAmount)) return { fulfilled: false, balance: this.getLicense()?.balance ?? null };
      if (row.status === "paid") return { fulfilled: false, balance: this.getLicense()?.balance ?? null };
      const updated = this.ctx.storage.sql.exec<{ balance: number }>("UPDATE licenses SET balance = balance + ?, updated_at = ? WHERE id = 1 RETURNING balance", row.credits, nowMs).toArray()[0];
      if (!updated) return { fulfilled: false, balance: null };
      this.ctx.storage.sql.exec("UPDATE payment_links SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'created'", nowMs, id);
      return { fulfilled: true, balance: updated.balance };
    });
    return result;
  }

  async consumeCredit(nowMs = Date.now()): Promise<{ consumed: boolean; balance: number | null }> {
    const updated = this.ctx.storage.sql.exec<{ balance: number }>("UPDATE licenses SET balance = balance - 1, updated_at = ? WHERE id = 1 AND balance > 0 RETURNING balance", nowMs).toArray()[0];
    return updated ? { consumed: true, balance: updated.balance } : { consumed: false, balance: this.getLicense()?.balance ?? null };
  }
}

function secondsUntilNextMinute(nowMs: number): number { return Math.max(1, Math.ceil((60_000 - (nowMs % 60_000)) / 1000)); }
function secondsUntilNextUtcDay(nowMs: number): number {
  const now = new Date(nowMs);
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - nowMs) / 1000));
}
