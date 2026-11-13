// Durable Object holding the daily counters. One instance serves the whole Worker, so a check
// and its increment can never interleave with another request's.
import { DurableObject } from 'cloudflare:workers';
import { applyTake, type Take, type TakeResult } from './limits';

export class Counters extends DurableObject {
  private day = '';

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS hits (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))');
  }

  /** Charges one graded answer to every counter, or to none when one of them is full. */
  take(day: string, takes: Take[]): TakeResult {
    const sql = this.ctx.storage.sql;
    if (day !== this.day) {
      // Yesterday's counters (and the fingerprints in them) are not kept.
      sql.exec('DELETE FROM hits WHERE day < ?', day);
      this.day = day;
    }
    const counts = new Map<string, number>();
    for (const t of takes) {
      const row = sql.exec<{ n: number }>('SELECT n FROM hits WHERE day = ? AND key = ?', day, t.key).toArray()[0];
      counts.set(t.key, row?.n ?? 0);
    }
    const res = applyTake(counts, takes);
    if (res.ok) for (const t of takes) sql.exec('INSERT INTO hits (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, t.key);
    return res;
  }

  /** Gives a charge back when grading failed on our side. */
  refund(day: string, keys: string[]): void {
    for (const key of keys) this.ctx.storage.sql.exec('UPDATE hits SET n = MAX(0, n - 1) WHERE day = ? AND key = ?', day, key);
  }
}
