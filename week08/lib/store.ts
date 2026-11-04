import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { RoundSettlement } from "./settlement-types";
export type Mode = "mock" | "fiber";
export type GameStatus =
  "COMMITTED" | "AWAITING_STAKE" | "PLAYING" | "WON" | "LOST" | "CANCELLED";
export interface Round {
  id: string;
  session: string;
  seed: string;
  commitment: string;
  clientSeed: string;
  nonce: string;
  edge: number;
  stake: string;
  reserve: string;
  opened: number[];
  game: GameStatus;
  payment: string;
  payout: string;
  created: number;
  stakeHash: string;
  stakePreimage: string;
  invoice: string;
  expires: number;
  stakeCreationStarted: boolean;
  recipient: string;
  payoutInvoice: string;
  payoutHash: string;
  payoutAttempt: string;
  payerStatus: string;
  receiverStatus: string;
  fee: string;
  error: string;
  settlement?: RoundSettlement;
}
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, balance TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rounds(id TEXT PRIMARY KEY, session TEXT NOT NULL, active INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS active_round ON rounds(session) WHERE active=1;
      CREATE TABLE IF NOT EXISTS payments(hash TEXT PRIMARY KEY, round_id TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, UNIQUE(round_id,kind));
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY, amount TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS round_channels(channel_id TEXT PRIMARY KEY, round_id TEXT NOT NULL UNIQUE);
    `);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  session(id: string) {
    this.db
      .prepare("INSERT OR IGNORE INTO sessions VALUES(?,?)")
      .run(id, "100000000000");
  }
  balance(id: string): bigint {
    return BigInt(
      (
        this.db.prepare("SELECT balance FROM sessions WHERE id=?").get(id) as {
          balance: string;
        }
      ).balance,
    );
  }
  balanceSet(id: string, value: bigint) {
    this.db
      .prepare("UPDATE sessions SET balance=? WHERE id=?")
      .run(value.toString(), id);
  }
  save(r: Round) {
    const active = ["COMMITTED", "AWAITING_STAKE", "PLAYING"].includes(r.game)
      ? 1
      : 0;
    this.db
      .prepare(
        "INSERT INTO rounds VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active,body=excluded.body",
      )
      .run(r.id, r.session, active, JSON.stringify(r));
  }
  claimChannel(channelId: string, roundId: string) {
    const existing = this.db
      .prepare("SELECT round_id FROM round_channels WHERE channel_id=?")
      .get(channelId) as { round_id: string } | undefined;
    if (existing && existing.round_id !== roundId)
      throw new Error(
        "This channel already belongs to another round. Open a new round channel.",
      );
    this.db
      .prepare("INSERT OR IGNORE INTO round_channels VALUES(?,?)")
      .run(channelId, roundId);
  }
  get(id: string, session?: string): Round {
    const row = this.db
      .prepare("SELECT body FROM rounds WHERE id=?")
      .get(id) as { body: string } | undefined;
    if (!row) throw new Error("Không tìm thấy ván.");
    const r: Round = JSON.parse(row.body);
    if (session && r.session !== session)
      throw new Error("Ván không thuộc session này.");
    return r;
  }
  list(session?: string): Round[] {
    const rows = session
      ? this.db
          .prepare(
            "SELECT body FROM rounds WHERE session=? ORDER BY rowid DESC LIMIT 50",
          )
          .all(session)
      : this.db.prepare("SELECT body FROM rounds").all();
    return rows.map((row) => JSON.parse(row.body as string) as Round);
  }
  payment(r: Round, kind: "stake" | "payout", hash: string, body: object) {
    this.db
      .prepare(
        "INSERT INTO payments VALUES(?,?,?,?) ON CONFLICT(round_id,kind) DO UPDATE SET body=excluded.body WHERE payments.hash=excluded.hash",
      )
      .run(hash, r.id, kind, JSON.stringify(body));
  }
  houseNet(): bigint {
    return this.db
      .prepare("SELECT amount FROM ledger")
      .all()
      .reduce((a, r) => a + BigInt(r.amount as string), 0n);
  }
  ledger(id: string, amount: bigint) {
    this.db
      .prepare("INSERT OR IGNORE INTO ledger VALUES(?,?)")
      .run(id, amount.toString());
  }
}
const stores = new Map<Mode, Store>();
export function getStore(mode: Mode) {
  let store = stores.get(mode);
  if (!store) {
    const dir = process.env.DATA_DIR || "./data";
    mkdirSync(dir, { recursive: true });
    store = new Store(join(dir, `${mode}.sqlite`));
    stores.set(mode, store);
  }
  return store;
}
