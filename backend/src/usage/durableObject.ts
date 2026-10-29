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
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS global_stats (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          generation_count INTEGER NOT NULL CHECK (generation_count >= 0),
          updated_at INTEGER NOT NULL
        )`);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS custom_topic_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          topic TEXT NOT NULL,
          language TEXT NOT NULL,
          source_app TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`);
      this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS custom_topic_events_created_at_idx ON custom_topic_events(created_at)");
      this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS custom_topic_events_topic_idx ON custom_topic_events(topic, language, source_app)");
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

  /** Read the shared generation total, initializing the public launch baseline once. */
  getGlobalGenerationCount(baseline = 500): number {
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("INSERT INTO global_stats (id, generation_count, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING", baseline, Date.now());
      const row = this.ctx.storage.sql.exec<{ generation_count: number }>("SELECT generation_count FROM global_stats WHERE id = 1").toArray()[0];
      if (!row) throw new Error("Global Vichar statistics could not be initialized.");
      return row.generation_count;
    });
  }

  /** Atomically count one successful generation on the shared global Durable Object. */
  recordGlobalGeneration(baseline = 500, nowMs = Date.now()): number {
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("INSERT INTO global_stats (id, generation_count, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING", baseline, nowMs);
      const row = this.ctx.storage.sql.exec<{ generation_count: number }>("UPDATE global_stats SET generation_count = generation_count + 1, updated_at = ? WHERE id = 1 RETURNING generation_count", nowMs).toArray()[0];
      if (!row) throw new Error("Global Vichar generation could not be recorded.");
      return row.generation_count;
    });
  }

  /** Store a minimal, versioned topic event with no user or request identifiers. */
  async recordCustomTopicEvent(event: {
    schemaVersion: 1;
    topic: string;
    language: string;
    sourceApp: string;
    createdAt: number;
  }): void {
    const topic = event.topic.trim().replace(/\s+/g, " ").toLowerCase();
    const language = event.language.trim().slice(0, 35) || "und";
    const sourceApp = event.sourceApp.trim();
    if (event.schemaVersion !== 1 || !topic || topic.length > 160 || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(sourceApp)) {
      throw new Error("Invalid custom topic analytics event.");
    }
    const nowMs = Number.isSafeInteger(event.createdAt) && event.createdAt > 0 ? event.createdAt : Date.now();
    const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("DELETE FROM custom_topic_events WHERE created_at <= ?", cutoff);
      this.ctx.storage.sql.exec(
        "INSERT INTO custom_topic_events (schema_version, topic, language, source_app, created_at) VALUES (1, ?, ?, ?, ?)",
        topic, language, sourceApp, nowMs,
      );
    });
    // One alarm on this existing Durable Object enforces physical 90-day expiry
    // without adding a Worker cron trigger or a separate scheduled service.
    const oldest = this.ctx.storage.sql.exec<{ created_at: number }>(
      "SELECT MIN(created_at) AS created_at FROM custom_topic_events",
    ).toArray()[0]?.created_at;
    if (oldest !== undefined && oldest !== null) {
      const nextExpiry = oldest + 90 * 24 * 60 * 60 * 1000 + 1;
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null || nextExpiry < currentAlarm) await this.ctx.storage.setAlarm(nextExpiry);
    }
  }

  /** Cloudflare Durable Object alarm: remove expired topic events and schedule the next expiry. */
  async alarm(): Promise<void> {
    const nowMs = Date.now();
    const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("DELETE FROM custom_topic_events WHERE created_at <= ?", cutoff);
    });
    const oldest = this.ctx.storage.sql.exec<{ created_at: number }>(
      "SELECT MIN(created_at) AS created_at FROM custom_topic_events",
    ).toArray()[0]?.created_at;
    if (oldest === undefined || oldest === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(oldest + 90 * 24 * 60 * 60 * 1000 + 1);
  }

  /** Return aggregates only; never expose individual event rows or identifiers. */
  getCustomTopicAnalytics(nowMs = Date.now()): {
    windowDays: 90;
    totalEvents: number;
    topics: Array<{ topic: string; count: number; languages: string[]; sourceApps: string[] }>;
    languages: Array<{ language: string; count: number }>;
    sourceApps: Array<{ sourceApp: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
  } {
    const cutoff = nowMs - 90 * 24 * 60 * 60 * 1000;
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("DELETE FROM custom_topic_events WHERE created_at <= ?", cutoff);
      const totalEvents = this.ctx.storage.sql.exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM custom_topic_events WHERE created_at > ?", cutoff,
      ).toArray()[0]?.count ?? 0;
      const topics = this.ctx.storage.sql.exec<{ topic: string; count: number; languages: string; source_apps: string }>(
        "SELECT topic, COUNT(*) AS count, GROUP_CONCAT(DISTINCT language) AS languages, GROUP_CONCAT(DISTINCT source_app) AS source_apps FROM custom_topic_events WHERE created_at >= ? GROUP BY topic ORDER BY count DESC, topic ASC LIMIT 100",
        cutoff,
      ).toArray().map((row) => ({
        topic: row.topic, count: row.count,
        languages: row.languages ? row.languages.split(",") : [],
        sourceApps: row.source_apps ? row.source_apps.split(",") : [],
      }));
      const languages = this.ctx.storage.sql.exec<{ language: string; count: number }>(
        "SELECT language, COUNT(*) AS count FROM custom_topic_events WHERE created_at >= ? GROUP BY language ORDER BY count DESC, language ASC",
        cutoff,
      ).toArray().map((row) => ({ language: row.language, count: row.count }));
      const sourceApps = this.ctx.storage.sql.exec<{ source_app: string; count: number }>(
        "SELECT source_app, COUNT(*) AS count FROM custom_topic_events WHERE created_at >= ? GROUP BY source_app ORDER BY count DESC, source_app ASC",
        cutoff,
      ).toArray().map((row) => ({ sourceApp: row.source_app, count: row.count }));
      const weekly = this.ctx.storage.sql.exec<{ week: string; count: number }>(
        "SELECT strftime('%Y-W%W', created_at / 1000, 'unixepoch') AS week, COUNT(*) AS count FROM custom_topic_events WHERE created_at >= ? GROUP BY week ORDER BY week ASC",
        cutoff,
      ).toArray().map((row) => ({ week: row.week, count: row.count }));
      return { windowDays: 90, totalEvents, topics, languages, sourceApps, weekly };
    });
  }
}

function secondsUntilNextMinute(nowMs: number): number { return Math.max(1, Math.ceil((60_000 - (nowMs % 60_000)) / 1000)); }
function secondsUntilNextUtcDay(nowMs: number): number {
  const now = new Date(nowMs);
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - nowMs) / 1000));
}
