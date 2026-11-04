import { createHash } from "node:crypto";
import { ccc } from "@ckb-ccc/core";
import type { Channel } from "@fiber-pay/sdk";
import type { Game } from "./game";
import type { Round } from "./store";
import { FiberPaymentAdapter } from "./payments";
import { publicKey } from "./public-key";
import { board } from "./fair";
import { parseCkb, payout } from "./money";
import type { LockScript, RoundSettlement } from "./settlement-types";

const GENESIS =
  "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
const hashPattern = /^0x[0-9a-f]{64}$/i;
function normalizeFundingOutpoint(value: unknown) {
  if (typeof value === "string") {
    const bytes = value.replace(/^0x/i, "");
    if (!/^[0-9a-f]{72}$/i.test(bytes))
      throw new Error("Fiber returned an invalid channel outpoint.");
    // Fiber 0.9.1 serializes an OutPoint as tx_hash + the packed u32 LE index.
    const indexLittleEndian = bytes.slice(64).match(/.{2}/g)!.reverse().join("");
    return {
      tx_hash: `0x${bytes.slice(0, 64)}`,
      index: `0x${BigInt(`0x${indexLittleEndian}`).toString(16)}`,
    };
  }
  if (!value || typeof value !== "object")
    throw new Error("This round is missing its channel funding outpoint.");
  const outpoint = value as { tx_hash?: unknown; index?: unknown };
  if (typeof outpoint.tx_hash !== "string" || !hashPattern.test(outpoint.tx_hash))
    throw new Error("This round has an invalid channel funding transaction hash.");
  if (
    (typeof outpoint.index !== "string" && typeof outpoint.index !== "number") ||
    !/^(0x[0-9a-f]+|[0-9]+)$/i.test(String(outpoint.index))
  )
    throw new Error("This round has an invalid channel funding output index.");
  const index = BigInt(String(outpoint.index));
  if (index > 0xffffffffn)
    throw new Error("This round has an invalid channel funding output index.");
  return { tx_hash: outpoint.tx_hash, index: `0x${index.toString(16)}` };
}
export type ChainTransaction = {
  transaction: {
    inputs: { previous_output: { tx_hash: string; index: string } }[];
    outputs: { lock: LockScript; capacity: string; type?: unknown }[];
    outputs_data: string[];
  } | null;
  tx_status: {
    status: "pending" | "proposed" | "committed" | "rejected" | "unknown";
    block_hash?: string;
  };
};
export async function ckbRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(
    process.env.CKB_TESTNET_RPC_URL || "https://testnet.ckb.dev/rpc",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok)
    throw new Error("CKB Testnet verification is unavailable. Try again.");
  const body = await response.json();
  if (body.error)
    throw new Error("CKB Testnet rejected the verification request.");
  return body.result as T;
}
export async function readTestnetTransaction(
  hash: string,
): Promise<ChainTransaction | null> {
  if (!hashPattern.test(hash)) throw new Error("Invalid transaction hash.");
  const [genesis, tx] = await Promise.all([
    ckbRpc<string>("get_block_hash", ["0x0"]),
    ckbRpc<ChainTransaction | null>("get_transaction", [hash]),
  ]);
  if (genesis !== GENESIS)
    throw new Error("Chain verifier is not CKB Testnet.");
  return tx;
}
function sameLock(a: LockScript, b: LockScript) {
  if (
    !a ||
    !b ||
    typeof a.code_hash !== "string" ||
    typeof b.code_hash !== "string" ||
    typeof a.args !== "string" ||
    typeof b.args !== "string"
  )
    return false;
  return (
    a.code_hash.toLowerCase() === b.code_hash.toLowerCase() &&
    a.hash_type === b.hash_type &&
    a.args.toLowerCase() === b.args.toLowerCase()
  );
}
export function verifyCloseTransaction(
  tx: ChainTransaction,
  binding: RoundSettlement,
) {
  const fundingOutpoint = normalizeFundingOutpoint(binding.fundingOutpoint);
  if (
    !tx.transaction ||
    !tx.transaction.inputs.some(
      ({ previous_output: out }) =>
        typeof out?.tx_hash === "string" &&
        out.tx_hash.toLowerCase() === fundingOutpoint.tx_hash.toLowerCase() &&
        BigInt(out.index) === BigInt(fundingOutpoint.index),
    )
  )
    throw new Error(
      "Closing transaction does not spend this round's funding cell.",
    );
  const amount = tx.transaction.outputs.reduce(
    (sum, output) =>
      sum +
      (!output.type && sameLock(output.lock, binding.closeScript)
        ? BigInt(output.capacity)
        : 0n),
    0n,
  );
  if (amount <= 0n)
    throw new Error(
      "Closing transaction does not return CKB to the round wallet.",
    );
  return amount.toString();
}
export function assertCanClose(r: Round) {
  if (!r.settlement)
    throw new Error("This round has no dedicated wallet channel.");
  if (r.game === "WON" && r.payment === "PAYOUT_PAID") return;
  if (r.game === "LOST" && r.payment === "NO_PAYOUT") return;
  if (r.game === "CANCELLED" && r.payment === "STAKE_UNPAID") return;
  throw new Error(
    "Finish the round and settle its Fiber payout before closing the channel.",
  );
}
export function resultProof(r: Round) {
  assertCanClose(r);
  if (!r.settlement?.closeTxHash)
    throw new Error(
      "Wait for the closing transaction before publishing the game proof.",
    );
  const payload = {
    version: "fiber-mines-receipt-v1",
    network: "ckb-testnet",
    roundId: r.id,
    commitment: r.commitment,
    serverSeed: r.seed,
    clientSeed: r.clientSeed,
    nonce: r.nonce,
    edgeBps: r.edge,
    stake: r.stake,
    payout: r.payout,
    outcome: r.game,
    opened: r.opened,
    mines: board(r.seed, r.clientSeed, r.nonce),
    stakeHash: r.stakeHash,
    payoutHash: r.payoutHash,
    channelId: r.settlement.channelId,
    fundingOutpoint: r.settlement.fundingOutpoint,
    walletAddress: r.settlement.walletAddress,
    closeTxHash: r.settlement.closeTxHash,
  };
  const canonical = JSON.stringify(payload);
  return {
    payload,
    canonical,
    digest: `0x${createHash("sha256").update(canonical).digest("hex")}`,
  };
}
export function verifyProofTransaction(
  tx: ChainTransaction,
  binding: RoundSettlement,
  digest: string,
) {
  if (
    !tx.transaction?.outputs.some(
      (output, index) =>
        !output.type &&
        sameLock(output.lock, binding.closeScript) &&
        tx.transaction!.outputs_data[index]?.toLowerCase() ===
          digest.toLowerCase(),
    )
  )
    throw new Error(
      "Transaction does not contain this game's proof digest at the original wallet lock.",
    );
}
async function houseChannel(
  g: Game,
  channelId: string,
): Promise<Channel | undefined> {
  if (g.mode !== "fiber")
    throw new Error(
      "On-chain settlement is only available in Fiber Testnet mode.",
    );
  const adapter = g.adapter as FiberPaymentAdapter;
  const list = await adapter.client.listChannels({ include_closed: true });
  return list.channels.find((channel) => channel.channel_id === channelId);
}
export async function bindRoundChannel(
  g: Game,
  channelId: string,
  recipient: string,
  walletAddress: string,
  stake: string,
): Promise<RoundSettlement> {
  if (!hashPattern.test(channelId))
    throw new Error("Open a dedicated channel with your wallet first.");
  if (!walletAddress.startsWith("ckt1"))
    throw new Error("Connect a CKB Testnet wallet.");
  const channel = await houseChannel(g, channelId);
  if (
    !channel ||
    publicKey(channel.pubkey) !== publicKey(recipient) ||
    !channel.enabled ||
    channel.funding_udt_type_script ||
    !["CHANNEL_READY", "ChannelReady"].includes(channel.state.state_name) ||
    !channel.channel_outpoint
  )
    throw new Error(
      "The round channel must be ready, funded with CKB and connected to this PLAYER.",
    );
  const address = await ccc.Address.fromString(
    walletAddress,
    new ccc.ClientPublicTestnet(),
  );
  if (
    BigInt(channel.local_balance) - BigInt(channel.offered_tlc_balance) <
      payout(parseCkb(stake), 7, g.edge()) + g.feeBudget ||
    BigInt(channel.remote_balance) - BigInt(channel.received_tlc_balance) <
      parseCkb(stake)
  )
    throw new Error(
      "This round channel needs enough HOUSE return liquidity for the maximum reward and enough PLAYER funding for the stake.",
    );
  const { codeHash, hashType, args } = address.script;
  return {
    channelId,
    walletAddress,
    fundingOutpoint: normalizeFundingOutpoint(channel.channel_outpoint),
    closeScript: { code_hash: codeHash, hash_type: hashType, args },
  };
}
export async function prepareClose(g: Game, session: string, id: string) {
  const round = g.store.get(id, session);
  assertCanClose(round);
  const channel = await houseChannel(g, round.settlement!.channelId);
  if (!channel || publicKey(channel.pubkey) !== publicKey(round.recipient))
    throw new Error("Round channel is unavailable on HOUSE.");
  if (
    channel.pending_tlcs.length ||
    BigInt(channel.offered_tlc_balance) ||
    BigInt(channel.received_tlc_balance)
  )
    throw new Error("Wait for pending Fiber transfers before closing.");
  g.store.tx(() => {
    const latest = g.store.get(id, session);
    assertCanClose(latest);
    latest.settlement!.closeRequestedAt ||= Date.now();
    latest.settlement!.closeStatus ||= "closing";
    g.store.save(latest);
  });
  return g.store.get(id, session).settlement!;
}
export async function syncSettlement(
  g: Game,
  session: string,
  id: string,
  proofTxHash?: string,
) {
  if (g.mode !== "fiber")
    throw new Error(
      "On-chain settlement is only available in Fiber Testnet mode.",
    );
  const round = g.store.get(id, session);
  assertCanClose(round);
  const binding = {
    ...round.settlement!,
    fundingOutpoint: normalizeFundingOutpoint(
      round.settlement!.fundingOutpoint,
    ),
  };
  let channel: Channel | undefined;
  try {
    channel = await houseChannel(g, binding.channelId);
  } catch (error) {
    // Once discovered, an on-chain receipt can be reverified without HOUSE.
    if (!binding.closeTxHash) throw error;
  }
  if (channel && publicKey(channel.pubkey) !== publicKey(round.recipient))
    throw new Error("Channel PLAYER mismatch.");
  const closeHash = channel?.shutdown_transaction_hash || binding.closeTxHash;
  const patch: Partial<RoundSettlement> = {
    fundingOutpoint: binding.fundingOutpoint,
  };
  if (closeHash) {
    if (binding.closeTxHash && binding.closeTxHash !== closeHash)
      throw new Error(
        "Closing transaction changed; manual reconciliation is required.",
      );
    const tx = await readTestnetTransaction(closeHash);
    patch.closeTxHash = closeHash;
    patch.closeStatus = "pending";
    patch.returnedAmount = "0";
    patch.closeBlockHash = undefined;
    if (tx?.tx_status.status === "rejected") patch.closeStatus = "rejected";
    else if (tx?.transaction) {
      patch.returnedAmount = verifyCloseTransaction(tx, binding);
      if (tx.tx_status.status === "committed" && tx.tx_status.block_hash) {
        patch.closeStatus = "confirmed";
        patch.closeBlockHash = tx.tx_status.block_hash;
      }
    }
  }
  // Build the digest from server-owned round data, never browser-supplied results.
  const candidate = { ...round, settlement: { ...binding, ...patch } };
  if (candidate.settlement.closeTxHash)
    patch.proofDigest = resultProof(candidate).digest;
  const proofHash = proofTxHash || binding.proofTxHash;
  if (
    proofTxHash &&
    binding.proofTxHash &&
    binding.proofTxHash !== proofTxHash &&
    binding.proofStatus !== "rejected"
  )
    throw new Error(
      "A proof transaction is already pending or confirmed. Reconcile the existing hash.",
    );
  if (proofHash) {
    if (!patch.proofDigest)
      throw new Error("Closing transaction is not yet available.");
    const tx = await readTestnetTransaction(proofHash);
    if (tx?.transaction) verifyProofTransaction(tx, binding, patch.proofDigest);
    else if (proofTxHash && tx?.tx_status.status !== "rejected")
      throw new Error(
        "Proof transaction is not visible yet. Retry with the same hash.",
      );
    patch.proofTxHash = proofHash;
    patch.proofStatus =
      tx?.transaction &&
      tx.tx_status.status === "committed" &&
      tx.tx_status.block_hash
        ? "confirmed"
        : tx?.tx_status.status === "rejected"
          ? "rejected"
          : "pending";
    patch.proofBlockHash = tx?.tx_status.block_hash;
  }
  g.store.tx(() => {
    const latest = g.store.get(id, session);
    Object.assign(latest.settlement!, patch);
    g.store.save(latest);
  });
  return g.store.get(id, session).settlement!;
}
