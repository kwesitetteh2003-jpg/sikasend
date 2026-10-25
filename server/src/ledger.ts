import { canonical, sha256 } from './util.js';

export interface LedgerEntry {
  seq: number;
  at: string;
  transferId: string;
  kind: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);

/** Append-only SHA-256 hash chain: editing any past entry breaks every hash after it. */
export class Ledger {
  private entries: LedgerEntry[] = [];
  constructor(private now: () => number = Date.now) {}

  append(transferId: string, kind: string, data: Record<string, unknown> = {}): LedgerEntry {
    const prevHash = this.entries.at(-1)?.hash ?? GENESIS;
    const base = { seq: this.entries.length, at: new Date(this.now()).toISOString(), transferId, kind, data, prevHash };
    const entry: LedgerEntry = { ...base, hash: sha256(prevHash + canonical(base)) };
    this.entries.push(entry);
    return entry;
  }

  all(): readonly LedgerEntry[] { return this.entries; }
  forTransfer(id: string) { return this.entries.filter((e) => e.transferId === id); }

  verify(): { ok: boolean; brokenAt?: number; length: number; head: string } {
    let prev = GENESIS;
    for (const e of this.entries) {
      const { hash, ...base } = e;
      if (e.prevHash !== prev || sha256(prev + canonical(base)) !== hash) return { ok: false, brokenAt: e.seq, length: this.entries.length, head: prev };
      prev = hash;
    }
    return { ok: true, length: this.entries.length, head: prev };
  }

  /** Session support: the hosted demo keeps each visitor's chain in their own signed session. */
  snapshot(): LedgerEntry[] { return this.entries.map((e) => ({ ...e })); }
  restore(entries: LedgerEntry[]) { this.entries = entries.map((e) => ({ ...e })); }

  /** test helper only */
  _tamper(seq: number, patch: Partial<LedgerEntry>) { Object.assign(this.entries[seq]!, patch); }
}
