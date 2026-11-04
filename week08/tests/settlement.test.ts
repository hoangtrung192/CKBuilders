import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Game } from "../lib/game";
import { Store } from "../lib/store";
import { FiberPaymentAdapter } from "../lib/payments";
import {
  assertCanClose,
  prepareClose,
  resultProof,
  syncSettlement,
  verifyCloseTransaction,
  verifyProofTransaction,
  type ChainTransaction,
} from "../lib/settlement";
import type { RoundSettlement } from "../lib/settlement-types";

const hash = (value: string) => `0x${value.repeat(64)}`;
const binding: RoundSettlement = {
  channelId: hash("a"),
  walletAddress: "ckt1-round-wallet",
  fundingOutpoint: { tx_hash: hash("b"), index: "0x1" },
  closeScript: {
    code_hash: hash("c"),
    hash_type: "type",
    args: `0x${"d".repeat(40)}`,
  },
};
const closeTx: ChainTransaction = {
  transaction: {
    inputs: [{ previous_output: binding.fundingOutpoint }],
    outputs: [{ lock: binding.closeScript, capacity: "0xba43b7400" }],
    outputs_data: ["0x"],
  },
  tx_status: { status: "pending" },
};
function fixture() {
  const g = new Game(new Store(":memory:"), "fiber", new FiberPaymentAdapter());
  const id = g.commit("owner").id;
  const round = g.store.get(id);
  Object.assign(round, {
    game: "LOST",
    payment: "NO_PAYOUT",
    recipient: `02${"1".repeat(64)}`,
    settlement: structuredClone(binding),
  });
  g.store.save(round);
  return { g, id, round };
}
test("cooperative close is gated by terminal gameplay and successful payout", () => {
  const { round } = fixture();
  assert.doesNotThrow(() => assertCanClose(round));
  assert.throws(() => assertCanClose({ ...round, game: "PLAYING" }));
  assert.throws(() =>
    assertCanClose({ ...round, game: "WON", payment: "PAYOUT_PENDING" }),
  );
  assert.doesNotThrow(() =>
    assertCanClose({ ...round, game: "WON", payment: "PAYOUT_PAID" }),
  );
});
test("receipt rejects unrelated funding cells, wrong wallets and typed-token returns", () => {
  assert.equal(
    verifyCloseTransaction(closeTx, binding),
    BigInt("0xba43b7400").toString(),
  );
  assert.throws(() =>
    verifyCloseTransaction(closeTx, {
      ...binding,
      fundingOutpoint: { ...binding.fundingOutpoint, index: "0x0" },
    }),
  );
  assert.throws(() =>
    verifyCloseTransaction(closeTx, {
      ...binding,
      closeScript: { ...binding.closeScript, args: "0x00" },
    }),
  );
  const typed = structuredClone(closeTx);
  typed.transaction!.outputs[0].type = binding.closeScript;
  assert.throws(() => verifyCloseTransaction(typed, binding));
});
test("game proof binds committed board, payment hashes, wallet and closing transaction", () => {
  const { round } = fixture();
  round.settlement!.closeTxHash = hash("e");
  const proof = resultProof(round);
  assert.equal(
    proof.digest,
    `0x${createHash("sha256").update(proof.canonical).digest("hex")}`,
  );
  assert.notEqual(resultProof({ ...round, stake: "123" }).digest, proof.digest);
  assert.equal(
    resultProof({
      ...round,
      settlement: { ...round.settlement!, closeStatus: "confirmed" },
    }).digest,
    proof.digest,
  );
  const tx = structuredClone(closeTx);
  tx.transaction!.outputs_data[0] = proof.digest;
  assert.doesNotThrow(() => verifyProofTransaction(tx, binding, proof.digest));
  assert.throws(() => verifyProofTransaction(tx, binding, hash("f")));
});
test("a dedicated channel cannot be reused by a second round", () => {
  const store = new Store(":memory:");
  store.tx(() => store.claimChannel(binding.channelId, "first"));
  assert.throws(() =>
    store.tx(() => store.claimChannel(binding.channelId, "second")),
  );
  assert.doesNotThrow(() =>
    store.tx(() => store.claimChannel(binding.channelId, "first")),
  );
});
test("closure and proof progress from pending to confirmed without crediting an internal CKB balance", async () => {
  const { g, id, round } = fixture();
  const originalFetch = globalThis.fetch;
  const previousRpc = process.env.FIBER_RPC_URL;
  process.env.FIBER_RPC_URL = "http://house.invalid";
  let committed = false;
  let tlcs = 0;
  const proofHash = hash("f");
  const shutdownHash = hash("e");
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(String(options?.body));
      let result: unknown;
      if (request.method === "list_channels")
        result = {
          channels: [
            {
              channel_id: binding.channelId,
              state: { state_name: "CHANNEL_READY" },
              pubkey: round.recipient,
              shutdown_transaction_hash: shutdownHash,
              pending_tlcs: Array(tlcs).fill({}),
              offered_tlc_balance: "0x0",
              received_tlc_balance: "0x0",
            },
          ],
        };
      else if (request.method === "get_block_hash")
        result =
          "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
      else {
        const tx = structuredClone(closeTx);
        if (request.params[0] === proofHash)
          tx.transaction!.outputs_data[0] = resultProof({
            ...round,
            settlement: { ...binding, closeTxHash: shutdownHash },
          }).digest;
        if (committed)
          tx.tx_status = { status: "committed", block_hash: hash("1") };
        result = tx;
      }
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    tlcs = 1;
    await assert.rejects(() => prepareClose(g, "owner", id), /pending Fiber/);
    tlcs = 0;
    await assert.rejects(() => prepareClose(g, "stranger", id));
    await prepareClose(g, "owner", id);
    const pending = await syncSettlement(g, "owner", id, proofHash);
    assert.equal(pending.closeStatus, "pending");
    assert.equal(pending.proofStatus, "pending");
    assert.equal(pending.returnedAmount, BigInt("0xba43b7400").toString());
    committed = true;
    await syncSettlement(g, "owner", id);
    const confirmed = await syncSettlement(g, "owner", id);
    assert.equal(confirmed.closeStatus, "confirmed");
    assert.equal(confirmed.proofStatus, "confirmed");
    assert.equal(g.state("owner").balance, null);
    assert.equal(g.store.houseNet(), 0n);
    await assert.rejects(
      () => syncSettlement(g, "owner", id, hash("2")),
      /already pending/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousRpc === undefined) delete process.env.FIBER_RPC_URL;
    else process.env.FIBER_RPC_URL = previousRpc;
    g.store.db.close();
  }
});
