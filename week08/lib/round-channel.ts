"use client";
import type {
  FiberBrowserNode,
  OpenChannelWithExternalFundingResult,
  CkbTransaction,
} from "@fiber-pay/sdk/browser";
import type { ccc } from "@ckb-ccc/connector-react";
import { parseCkb } from "./money";
import { publicKey } from "./public-key";

export type RoundChannel = {
  channelId: `0x${string}`;
  walletAddress: string;
  player: string;
  unsignedFundingTx: CkbTransaction;
  fundingTxHash?: string;
};
const recordKey = (player: string, wallet: string) =>
  `fiber-mines-external-channel:${player}:${wallet}`;
// Fiber's WASM response can contain bigint values even though the JSON-RPC
// transaction schema represents these quantities as hex strings. Persist
// bigints in that same hex form so a failed save cannot strand the opening
// marker or prevent the wallet signer from being reached.
function stringifyRecoveryData(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? `0x${item.toString(16)}` : item,
  );
}
export function loadRoundChannel(
  player: string,
  wallet: string,
): RoundChannel | null {
  const stored = localStorage.getItem(recordKey(player, wallet));
  if (!stored) return null;
  try {
    return JSON.parse(stored) as RoundChannel;
  } catch {
    throw new Error(
      "Stored channel recovery data is unreadable. Do not clear browser storage; inspect the existing channels.",
    );
  }
}
export function archiveRoundChannel(
  player: string,
  wallet: string,
  expectedChannelId: string,
) {
  const key = recordKey(player, wallet);
  const existing = loadRoundChannel(player, wallet);
  if (!existing) return;
  if (existing.channelId !== expectedChannelId)
    throw new Error("Stored round channel changed; inspect it before continuing.");
  const signedAttempt = localStorage.getItem(`${key}:signed`);
  localStorage.setItem(
    `${key}:archive:${existing.channelId}`,
    stringifyRecoveryData({ record: existing, signedAttempt }),
  );
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}:signed`);
}
/** Negotiate and persist the unsigned transaction without asking the wallet to sign. */
export async function prepareRoundChannelFunding(
  node: FiberBrowserNode,
  signer: ccc.Signer,
  house: string,
  amount: string,
  houseChannels: Array<{ pubkey: string; state: string }>,
  existingFundingTxStatus?: string,
): Promise<RoundChannel> {
  if (signer.client.addressPrefix !== "ckt")
    throw new Error("Switch to CKB Testnet.");
  const wallet = await signer.getRecommendedAddress();
  const player = (await node.nodeInfo()).pubkey;
  const key = recordKey(player, wallet);
  let existing = loadRoundChannel(player, wallet);
  const channels = await node.listChannels({ include_closed: true });
  const livePlayer = channels.channels.some(
    (channel) => channel.pubkey.toLowerCase() === house.toLowerCase() &&
      !["CLOSED", "Closed"].includes(channel.state.state_name),
  );
  const liveHouse = houseChannels.some(
    (channel) => channel.pubkey.toLowerCase() === player.toLowerCase() &&
      !["CLOSED", "Closed"].includes(channel.state),
  );
  if (livePlayer || liveHouse)
    throw new Error("A PLAYER↔HOUSE channel is already pending or open. Inspect it before creating another.");
  if (localStorage.getItem(`${key}:opening`))
    localStorage.removeItem(`${key}:opening`);
  if (existing) {
    if (existing.fundingTxHash && existingFundingTxStatus !== "rejected")
      throw new Error("The saved funding transaction is not confirmed rejected. Do not prepare a duplicate channel.");
    const signedAttempt = localStorage.getItem(`${key}:signed`);
    localStorage.setItem(`${key}:archive:${existing.channelId}`, stringifyRecoveryData({ record: existing, signedAttempt }));
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:signed`);
    existing = null;
  }
  const walletSdk = (await import("@ckb-ccc/connector-react")).ccc;
  const sdk = await import("@fiber-pay/sdk/browser");
  const resolved = await sdk.createCccExternalFundingResolver({
    signer,
    knownScripts: Object.values(walletSdk.KnownScript),
  })({});
  localStorage.setItem(`${key}:opening`, String(Date.now()));
  try {
    const opened = await node.openChannelWithExternalFunding({
      pubkey: publicKey(house) as `0x${string}`,
      funding_amount: `0x${parseCkb(amount).toString(16)}`,
      funding_fee_rate: "0x7d0",
      public: false,
      funding_lock_script: resolved.fundingLockScript,
      funding_lock_script_cell_deps: resolved.fundingLockScriptCellDeps,
      shutdown_script: resolved.shutdownScript,
    });
    const record: RoundChannel = {
      channelId: opened.channel_id,
      player,
      walletAddress: wallet,
      unsignedFundingTx: opened.unsigned_funding_tx,
    };
    localStorage.setItem(key, stringifyRecoveryData(record));
    localStorage.removeItem(`${key}:opening`);
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Received TxAbort|AbortFundingWithDetail|Funding failed/i.test(message))
      localStorage.removeItem(`${key}:opening`);
    throw error;
  }
}
export async function openRoundChannel(
  node: FiberBrowserNode,
  signer: ccc.Signer,
  house: string,
  amount: string,
  houseChannels?: Array<{ pubkey: string; state: string }>,
): Promise<RoundChannel> {
  if (signer.client.addressPrefix !== "ckt")
    throw new Error("Switch to CKB Testnet.");
  const wallet = await signer.getRecommendedAddress();
  const player = (await node.nodeInfo()).pubkey;
  const key = recordKey(player, wallet);
  let existing = loadRoundChannel(player, wallet);
  const channels = await node.listChannels({ include_closed: true });
  if (localStorage.getItem(`${key}:opening`)) {
    if (!houseChannels)
      throw new Error(
        "A channel-opening request has an unknown result. Check both PLAYER and HOUSE channel lists before retrying.",
      );
    const playerHasHouseChannel = channels.channels.some(
      (channel) =>
        channel.pubkey.toLowerCase() === house.toLowerCase() &&
        !["CLOSED", "Closed"].includes(channel.state.state_name),
    );
    const houseHasPlayerChannel = houseChannels.some(
      (channel) =>
        channel.pubkey.toLowerCase() === player.toLowerCase() &&
        !["CLOSED", "Closed"].includes(channel.state),
    );
    if (playerHasHouseChannel || houseHasPlayerChannel)
      throw new Error(
        "A channel-opening request is still visible on PLAYER or HOUSE. Do not retry; inspect its state first.",
      );
    // Both nodes have now been queried and neither has a live channel for the
    // other, so the unsigned attempt did not become a channel. Clear only its
    // stale in-progress marker; keep all saved transaction recovery data.
    localStorage.removeItem(`${key}:opening`);
  }
  const old = channels.channels.find(
    (channel) => channel.channel_id === existing?.channelId,
  );
  if (existing && old && !["CLOSED", "Closed"].includes(old.state.state_name)) {
    if (
      ["CHANNEL_READY", "ChannelReady"].includes(old.state.state_name) ||
      existing.fundingTxHash
    )
      return existing;
    if (old.shutdown_transaction_hash)
      throw new Error(
        "The previous channel is still closing. Wait for its receipt.",
      );
  }
  // If the channel never reached either node and no funding hash was saved,
  // resume with the exact unsigned transaction from local storage. Never ask
  // Fiber to create a second channel for the same wallet/peer attempt.
  if (existing && !old) {
    const houseHasExistingChannel = houseChannels?.some(
      (channel) =>
        channel.pubkey.toLowerCase() === player.toLowerCase() &&
        !["CLOSED", "Closed"].includes(channel.state),
    );
    if (existing.fundingTxHash || houseHasExistingChannel)
      throw new Error(
        "The previous channel is not visible on PLAYER but may still exist on HOUSE or chain. Inspect its state before resuming.",
      );
    const signedAttempt = localStorage.getItem(`${key}:signed`);
    localStorage.setItem(
      `${key}:archive:${existing.channelId}`,
      stringifyRecoveryData({ record: existing, signedAttempt }),
    );
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:signed`);
    existing = null;
  }
  const sdk = await import("@fiber-pay/sdk/browser");
  const walletSdk = (await import("@ckb-ccc/connector-react")).ccc;
  const resolved = await sdk.createCccExternalFundingResolver({
    signer,
    knownScripts: Object.values(walletSdk.KnownScript),
  })({});
  let record =
    existing &&
    (!old || !["CLOSED", "Closed"].includes(old.state.state_name))
      ? existing
      : null;
  const result = await sdk.openChannelWithExternalFundingFlow({
    node: {
      openChannelWithExternalFunding: async (params) => {
        if (record)
          return {
            channel_id: record.channelId,
            unsigned_funding_tx: record.unsignedFundingTx,
          } as OpenChannelWithExternalFundingResult;
        localStorage.setItem(`${key}:opening`, String(Date.now()));
        let opened: OpenChannelWithExternalFundingResult;
        try {
          opened = await node.openChannelWithExternalFunding(params);
        } catch (error) {
          // A peer TxAbort before the unsigned transaction is returned is a
          // definitive rejection: there is nothing the wallet could have
          // signed or broadcast. Release the local in-progress marker so the
          // operator can correct the peer-side cause and retry. Keep the
          // marker for timeouts and other ambiguous failures.
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            /Received TxAbort|AbortFundingWithDetail|Funding failed/i.test(
              message,
            )
          )
            localStorage.removeItem(`${key}:opening`);
          throw error;
        }
        record = {
          channelId: opened.channel_id,
          player,
          walletAddress: wallet,
          unsignedFundingTx: opened.unsigned_funding_tx,
        };
        localStorage.setItem(key, stringifyRecoveryData(record));
        localStorage.removeItem(`${key}:opening`);
        return opened;
      },
      submitSignedFundingTx: async (params) => {
        // Persist the signed attempt before submission for safe recovery after reload.
        localStorage.setItem(`${key}:signed`, stringifyRecoveryData(params));
        const rpcParams = JSON.parse(
          stringifyRecoveryData(params),
        ) as typeof params;
        return node.submitSignedFundingTx(rpcParams);
      },
    },
    params: {
      pubkey: publicKey(house) as `0x${string}`,
      funding_amount: `0x${parseCkb(amount).toString(16)}`,
      // The public Testnet RPC rejected the default funding transaction as
      // 20 shannons below its current minimum. Use 2,000 shannons/KW to leave
      // headroom over the observed 1,000 shannons/KW relay minimum.
      funding_fee_rate: "0x7d0",
      public: false,
      funding_lock_script: resolved.fundingLockScript,
      funding_lock_script_cell_deps: resolved.fundingLockScriptCellDeps,
      shutdown_script: resolved.shutdownScript,
    },
    signFundingTx: async (transaction) => {
      const original = walletSdk.Transaction.from(
        transaction as Parameters<typeof walletSdk.Transaction.from>[0],
      ).hash();
      const saved = localStorage.getItem(`${key}:signed`);
      const attempt = saved ? JSON.parse(saved) : null;
      const signed =
        attempt?.channel_id === record?.channelId
          ? attempt.signed_funding_tx
          : await resolved.signFundingTx(transaction);
      const normalized = sdk.normalizeCkbTransactionForCcc(signed);
      if (
        walletSdk.Transaction.from(
          normalized as Parameters<typeof walletSdk.Transaction.from>[0],
        ).hash() !== original
      )
        throw new Error(
          "Wallet changed the negotiated funding transaction. Only signatures may change; no transaction was submitted.",
        );
      return signed;
    },
  });
  const finalRecord: RoundChannel = {
    channelId: result.channelId,
    player,
    walletAddress: wallet,
    unsignedFundingTx: result.unsignedFundingTx,
    fundingTxHash: result.fundingTxHash,
  };
  localStorage.setItem(key, stringifyRecoveryData(finalRecord));
  return finalRecord;
}
