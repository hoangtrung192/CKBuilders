import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ccc } from "@ckb-ccc/core";
import { verifyBoard } from "../lib/verify-browser";
import { payout } from "../lib/money";
import {
  readTestnetTransaction,
  verifyCloseTransaction,
  verifyProofTransaction,
} from "../lib/settlement";

const path = process.argv[2];
if (!path)
  throw new Error("Usage: pnpm verify:receipt <downloaded-receipt.json>");
const receipt = JSON.parse(readFileSync(path, "utf8"));
const { payload, canonical, digest, settlement } = receipt;
assert.equal(payload.version, "fiber-mines-receipt-v1");
assert.equal(payload.network, "ckb-testnet");
assert.equal(
  JSON.stringify(payload),
  canonical,
  "Canonical payload differs from the receipt",
);
assert.equal(
  `0x${createHash("sha256").update(canonical).digest("hex")}`,
  digest,
  "Digest mismatch",
);
const verified = await verifyBoard(
  payload.serverSeed,
  payload.clientSeed,
  payload.nonce,
  payload.commitment,
);
assert.equal(verified.valid, true, "Server commitment mismatch");
assert.deepEqual(verified.mines, payload.mines);
assert.equal(new Set(payload.opened).size, payload.opened.length);
assert.ok(
  payload.opened.every(
    (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < 9,
  ),
);
if (payload.outcome === "WON") {
  assert.ok(payload.opened.length >= 1 && payload.opened.length <= 7);
  assert.ok(
    payload.opened.every((cell: number) => !verified.mines.includes(cell)),
  );
  assert.equal(
    payout(
      BigInt(payload.stake),
      payload.opened.length,
      payload.edgeBps,
    ).toString(),
    payload.payout,
  );
} else {
  assert.equal(payload.payout, "0");
  if (payload.outcome === "LOST")
    assert.ok(verified.mines.includes(payload.opened.at(-1)));
  else assert.equal(payload.outcome, "CANCELLED");
}
assert.equal(settlement.channelId, payload.channelId);
assert.equal(settlement.closeTxHash, payload.closeTxHash);
assert.equal(settlement.walletAddress, payload.walletAddress);
assert.deepEqual(settlement.fundingOutpoint, payload.fundingOutpoint);
const address = await ccc.Address.fromString(
  payload.walletAddress,
  new ccc.ClientPublicTestnet(),
);
assert.deepEqual(settlement.closeScript, {
  code_hash: address.script.codeHash,
  hash_type: address.script.hashType,
  args: address.script.args,
});
const close = await readTestnetTransaction(payload.closeTxHash);
assert.ok(close?.transaction, "Closing transaction not found");
assert.equal(
  close.tx_status.status,
  "committed",
  "Closing transaction is not confirmed",
);
const returned = verifyCloseTransaction(close, settlement);
assert.ok(settlement.proofTxHash, "Game proof has not been published");
const proof = await readTestnetTransaction(settlement.proofTxHash);
assert.ok(proof?.transaction, "Proof transaction not found");
verifyProofTransaction(proof, settlement, digest);
assert.equal(
  proof.tx_status.status,
  "committed",
  "Proof transaction is not confirmed",
);
console.log(
  `Verified board, payout arithmetic, CKB Testnet closing transaction and on-chain game digest. Wallet return: ${ccc.fixedPointToString(BigInt(returned))} CKB.`,
);
