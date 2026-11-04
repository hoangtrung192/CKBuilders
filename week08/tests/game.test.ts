import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../lib/store";
import { Game } from "../lib/game";
import { MockPaymentAdapter, validateInvoice } from "../lib/payments";
import { board, commit } from "../lib/fair";
import { parseCkb, payout, UNIT } from "../lib/money";
import { verifyBoard } from "../lib/verify-browser";
import type { CkbInvoice } from "@fiber-pay/sdk";
function fixture(adapter = new MockPaymentAdapter(), path = ":memory:") {
  const store = new Store(path),
    g = new Game(store, "mock", adapter);
  const r = g.commit("alice");
  // Test-only fixed seed, absent from runtime API and production game options.
  const raw = store.get(r.id);
  raw.seed = "fixed-server-seed";
  raw.commitment = commit(raw.seed);
  raw.nonce = "42";
  store.save(raw);
  const mines = board(raw.seed, "client", "42"),
    safe = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((x) => !mines.includes(x));
  return { g, store, id: r.id, mines, safe };
}
test("exact integer payouts for all seven steps; rounding only at settlement", () => {
  assert.equal(payout(parseCkb("10"), 1), parseCkb("12.6"));
  assert.equal(payout(parseCkb("10"), 7), parseCkb("352.8"));
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((k) => payout(UNIT, k)),
    [
      126000000n,
      168000000n,
      235200000n,
      352800000n,
      588000000n,
      1176000000n,
      3528000000n,
    ],
  );
  assert.equal(payout(1n, 1), 1n);
  assert.equal(parseCkb("0.00000001"), 1n);
  for (const invalid of ["-1", "1e3", "1.000000001", "NaN", " 1", "+1"])
    assert.throws(() => parseCkb(invalid));
});
test("fixed board has two distinct mines; independent verifier checks commitment", async () => {
  const expected = board("server", "client", "42");
  assert.equal(new Set(expected).size, 2);
  assert.deepEqual(board("server", "client", "42"), expected);
  const v = await verifyBoard("server", "client", "42", commit("server"));
  assert.equal(v.valid, true);
  assert.deepEqual(v.mines, expected);
  assert.equal(
    (await verifyBoard("tampered", "client", "42", commit("server"))).valid,
    false,
  );
});
test("commit issued before seed pair locks; active API never leaks seed or mines", async () => {
  const { g, id } = fixture();
  assert.equal(g.commit("alice").id, id);
  const view = await g.start("alice", id, "10", "client");
  assert.equal(view.game, "PLAYING");
  assert.equal(view.serverSeed, undefined);
  assert.equal(view.mines, undefined);
  const serialized = JSON.stringify(g.state("alice"));
  assert.ok(!serialized.includes("fixed-server-seed"));
  assert.ok(!serialized.includes("stakePreimage"));
  await assert.rejects(g.start("alice", id, "10", "changed"));
});
test("mine loses stake and ends board with zero payout", async () => {
  const { g, id, mines } = fixture();
  await g.start("alice", id, "10", "client");
  const result = g.reveal("alice", id, mines[0]);
  assert.equal(result.game, "LOST");
  assert.equal(result.payout, "0");
  assert.equal(g.state("alice").balance, parseCkb("990").toString());
  assert.throws(() => g.cashout("alice", id));
  assert.throws(() => g.reveal("alice", id, 8));
});
test("cashout after one safe cell credits gross exactly once under duplicate requests", async () => {
  const { g, id, safe } = fixture();
  await g.start("alice", id, "10", "client");
  assert.throws(() => g.cashout("alice", id));
  g.reveal("alice", id, safe[0]);
  assert.throws(() => g.reveal("alice", id, safe[0]));
  g.cashout("alice", id);
  await Promise.all([
    g.pay("alice", id),
    g.pay("alice", id),
    g.pay("alice", id),
  ]);
  assert.equal(g.state("alice").balance, parseCkb("1002.6").toString());
  assert.equal(g.store.get(id).reserve, "0");
});
test("seven safe cells automatically lock maximum gross payout", async () => {
  const { g, id, safe } = fixture();
  await g.start("alice", id, "10", "client");
  for (const cell of safe) g.reveal("alice", id, cell);
  assert.equal(g.store.get(id).game, "WON");
  assert.equal(g.store.get(id).payout, parseCkb("352.8").toString());
  await g.pay("alice", id);
  assert.equal(g.state("alice").balance, parseCkb("1342.8").toString());
});
test("ownership enforced for start/reveal/cashout/payment/reconciliation", async () => {
  const { g, id, safe } = fixture();
  await assert.rejects(g.start("bob", id, "10", "client"));
  await g.start("alice", id, "10", "client");
  assert.throws(() => g.reveal("bob", id, safe[0]));
  g.reveal("alice", id, safe[0]);
  assert.throws(() => g.cashout("bob", id));
  g.cashout("alice", id);
  await assert.rejects(g.pay("bob", id));
  await assert.rejects(g.reconcile("bob", id));
  assert.equal(g.state("bob").rounds.length, 0);
});
test("parallel starts charge once and unique active round prevents a second game", async () => {
  const { g, id } = fixture();
  await Promise.all([
    g.start("alice", id, "10", "client"),
    g.start("alice", id, "10", "client"),
  ]);
  assert.equal(g.commit("alice").id, id);
  assert.equal(g.state("alice").balance, parseCkb("990").toString());
});
test("invalid stake and cell boundaries rejected", async () => {
  const { g, id } = fixture();
  for (const s of ["0", "-1", "101", "0.000000001"])
    await assert.rejects(g.start("alice", id, s, "client"));
  await g.start("alice", id, "1", "client");
  for (const n of [-1, 9, 1.5, NaN])
    assert.throws(() => g.reveal("alice", id, n));
});
test("house reserves worst-case exposure atomically across sessions", async () => {
  const { g, id } = fixture();
  g.budget = parseCkb("360");
  await g.start("alice", id, "10", "client");
  const second = g.commit("bob");
  await assert.rejects(g.start("bob", second.id, "10", "client"), /HOUSE/);
});
class Unpaid extends MockPaymentAdapter {
  status = "Open";
  override async stakeStatus() {
    return this.status;
  }
}
test("unpaid or expired stake cannot open the board; paid recovers after delay", async () => {
  const adapter = new Unpaid(),
    { g, id } = fixture(adapter);
  await g.start("alice", id, "10", "client");
  assert.equal(g.store.get(id).game, "AWAITING_STAKE");
  assert.throws(() => g.reveal("alice", id, 0));
  adapter.status = "Paid";
  await g.checkStake("alice", id);
  assert.equal(g.store.get(id).game, "PLAYING");
  const other = fixture(adapter);
  adapter.status = "Expired";
  await other.g.start("alice", other.id, "10", "client");
  assert.equal(other.g.store.get(other.id).game, "CANCELLED");
  assert.equal(other.g.store.get(other.id).reserve, "0");
});
test("invoice validation rejects wrong currency, amount, recipient, UDT, expiry and hash", () => {
  const recipient = `0x02${"1".repeat(64)}` as const;
  const invoice: CkbInvoice = {
    currency: "Fibt",
    amount: "0x64",
    data: {
      timestamp: `0x${Date.now().toString(16)}`,
      payment_hash: `0x${"2".repeat(64)}`,
      attrs: [{ expiry_time: "0x384" }, { payee_public_key: recipient }],
    },
  };
  assert.doesNotThrow(() => validateInvoice(invoice, "100", recipient));
  // Real fnn 0.9.1 public keys omit 0x, even though SDK 0.3.3 types include it.
  assert.doesNotThrow(() =>
    validateInvoice(invoice, "100", recipient.slice(2)),
  );
  assert.throws(() => validateInvoice({ ...invoice, currency: "Fibb" }, "100"));
  assert.throws(() => validateInvoice(invoice, "101"));
  assert.throws(() => validateInvoice(invoice, "100", `0x03${"1".repeat(64)}`));
  assert.throws(() =>
    validateInvoice(
      { ...invoice, data: { ...invoice.data, timestamp: "0x0" } },
      "100",
    ),
  );
  assert.throws(() =>
    validateInvoice(
      {
        ...invoice,
        data: {
          ...invoice.data,
          attrs: [...invoice.data.attrs, { udt_script: "0x01" }],
        },
      },
      "100",
    ),
  );
  assert.throws(() =>
    validateInvoice(
      { ...invoice, data: { ...invoice.data, payment_hash: "0x12" } },
      "100",
    ),
  );
});
class Uncertain extends MockPaymentAdapter {
  sends = 0;
  status = "Inflight";
  override async send() {
    this.sends++;
    throw new Error("timeout");
    return { status: "Success", fee: "0" };
  }
  override async reconcile() {
    return { status: this.status, fee: "0" };
  }
}
test("timeout retains payout debt; restart reconciles old hash without another send", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "fiber-mines-")), "mock.sqlite"),
    adapter = new Uncertain();
  const { g, store, id, safe } = fixture(adapter, path);
  await g.start("alice", id, "10", "client");
  g.reveal("alice", id, safe[0]);
  g.cashout("alice", id);
  await g.pay("alice", id);
  assert.equal(store.get(id).payment, "PAYOUT_PENDING");
  const hash = store.get(id).payoutHash;
  store.db.close();
  const restarted = new Game(new Store(path), "mock", adapter);
  await restarted.pay("alice", id);
  assert.equal(adapter.sends, 1);
  assert.equal(restarted.store.get(id).payoutHash, hash);
  adapter.status = "Success";
  await restarted.reconcile("alice", id);
  await restarted.reconcile("alice", id);
  assert.equal(restarted.store.balance("alice"), parseCkb("1002.6"));
  assert.equal(adapter.sends, 1);
  restarted.store.db.close();
});
test("Failed payout retains debt and reserve, without automatic resend", async () => {
  const adapter = new Uncertain(),
    { g, id, safe } = fixture(adapter);
  await g.start("alice", id, "10", "client");
  g.reveal("alice", id, safe[0]);
  g.cashout("alice", id);
  await g.pay("alice", id);
  adapter.status = "Failed";
  await g.pay("alice", id);
  assert.equal(g.store.get(id).game, "WON");
  assert.equal(g.store.get(id).payment, "PAYOUT_PENDING");
  assert.ok(BigInt(g.store.get(id).reserve) > 0n);
  assert.equal(adapter.sends, 1);
});
test("mock reset never writes Fiber database; Fiber reset rejected", () => {
  const mock = fixture(),
    fiberStore = new Store(":memory:");
  fiberStore.session("alice");
  fiberStore.balanceSet("alice", 123n);
  mock.g.reset("alice");
  assert.equal(fiberStore.balance("alice"), 123n);
  assert.throws(() =>
    new Game(fiberStore, "fiber", new MockPaymentAdapter()).reset("alice"),
  );
});
