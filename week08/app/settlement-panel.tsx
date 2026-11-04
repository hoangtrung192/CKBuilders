"use client";
import { ccc } from "@ckb-ccc/connector-react";
import type { FiberBrowserNode } from "@fiber-pay/sdk/browser";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatCkb } from "../lib/money";
import type { RoundSettlement } from "../lib/settlement-types";
import { publicKey } from "../lib/public-key";
import { useWalletAccount } from "./wallet-account";

type ReceiptRound = {
  id: string;
  game: string;
  payment: string;
  payout: string;
  stakeHash: string;
  payoutHash: string;
  recipient: string;
  settlement?: RoundSettlement | null;
};
type Command = (
  action: string,
  fields?: Record<string, unknown>,
) => Promise<{
  rounds?: ReceiptRound[];
  digest?: string;
  canonical?: string;
  payload?: unknown;
}>;
const explorer = (hash: string) =>
  `https://testnet.explorer.nervos.org/transaction/${hash}`;
export function SettlementPanel({
  round,
  node,
  command,
  claim,
  demo,
  autoClaim = true,
}: {
  round?: ReceiptRound;
  node: FiberBrowserNode | null;
  command: Command;
  claim: () => Promise<void>;
  demo: boolean;
  autoClaim?: boolean;
}) {
  const { account, refresh } = useWalletAccount();
  const [auto, setAuto] = useState(autoClaim);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const inProgress = useRef(false);
  const binding = round?.settlement;
  const hasBinding = !!binding;
  const terminal = !!round && ["WON", "LOST", "CANCELLED"].includes(round.game);
  async function advance(automatic = false) {
    if (!round || !binding || inProgress.current) return;
    inProgress.current = true;
    setWorking(true);
    try {
      if (binding.closeTxHash) {
        const savedProof = localStorage.getItem(
          `fiber-mines-result-proof:${round.id}`,
        );
        await command("sync-settlement", {
          id: round.id,
          ...(savedProof && !binding.proofTxHash
            ? { proofTxHash: savedProof }
            : {}),
        });
        await refresh();
        setError("");
        return;
      }
      if (automatic && !auto) return;
      if (!node)
        throw new Error(
          "Unlock the same Fiber node to claim and close this round.",
        );
      if (
        publicKey((await node.nodeInfo()).pubkey) !== publicKey(round.recipient)
      )
        throw new Error("Unlock the Fiber identity used by this round.");
      let latest = round;
      if (round.game === "WON" && round.payment !== "PAYOUT_PAID") {
        await claim();
        const checked = await command("check", { id: round.id });
        latest = checked.rounds?.find((item) => item.id === round.id) || round;
        if (latest.payment !== "PAYOUT_PAID") return;
      }
      await command("prepare-close", { id: round.id });
      const channels = await node.listChannels({ include_closed: true });
      const channel = channels.channels.find(
        (item) => item.channel_id === binding.channelId,
      );
      if (!channel)
        throw new Error(
          "The round channel is not visible on this node. Reconnect before retrying.",
        );
      if (
        ["CHANNEL_READY", "ChannelReady"].includes(channel.state.state_name)
      ) {
        if (channel.pending_tlcs.length) return;
        await node.shutdownChannel({
          channel_id: binding.channelId as `0x${string}`,
          close_script: binding.closeScript as {
            code_hash: `0x${string}`;
            hash_type: "type" | "data" | "data1" | "data2";
            args: `0x${string}`;
          },
          fee_rate: "0x3e8",
          force: false,
        });
      }
      await command("sync-settlement", { id: round.id });
      await refresh();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Settlement could not be checked. Your existing payment hashes are preserved.",
      );
      if (!binding.closeTxHash) setAuto(false);
    } finally {
      inProgress.current = false;
      setWorking(false);
    }
  }
  const onTick = useEffectEvent(() => {
    void advance(true);
  });
  useEffect(() => {
    if (demo || !terminal || !hasBinding) return;
    const timer = setInterval(onTick, 8000);
    const initial = setTimeout(onTick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [demo, terminal, round?.id, hasBinding, auto]);
  async function publishProof() {
    if (!round || !binding || !account || inProgress.current) return;
    inProgress.current = true;
    setWorking(true);
    setError("");
    const key = `fiber-mines-result-proof:${round.id}`;
    try {
      if (
        account.address !== binding.walletAddress ||
        account.signer.client.addressPrefix !== "ckt"
      )
        throw new Error("Use the original CKB Testnet wallet.");
      const savedHash = localStorage.getItem(key);
      if (savedHash && binding.proofStatus !== "rejected") {
        await command("sync-settlement", {
          id: round.id,
          proofTxHash: savedHash,
        });
        return;
      }
      const receipt = await command("receipt", { id: round.id });
      if (!receipt.canonical || !receipt.digest)
        throw new Error("Receipt is not ready.");
      const digest = `0x${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(receipt.canonical))), (value) => value.toString(16).padStart(2, "0")).join("")}`;
      if (digest !== receipt.digest)
        throw new Error("Receipt digest does not match.");
      const { script: lock } = await ccc.Address.fromString(
        binding.walletAddress,
        account.signer.client,
      );
      const output = ccc.CellOutput.from({ lock }, digest as `0x${string}`);
      const tx = ccc.Transaction.from({
        outputs: [output],
        outputsData: [digest],
      });
      await tx.completeInputsByCapacity(account.signer);
      await tx.completeFeeBy(account.signer);
      if (
        (await account.signer.getRecommendedAddress()) !== binding.walletAddress
      )
        throw new Error(
          "Wallet account changed. Try again with the round wallet.",
        );
      const txHash = await account.signer.sendTransaction(tx);
      localStorage.setItem(key, txHash);
      await command("sync-settlement", { id: round.id, proofTxHash: txHash });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Proof transaction was cancelled or failed.",
      );
    } finally {
      inProgress.current = false;
      setWorking(false);
    }
  }
  async function downloadReceipt() {
    if (!round) return;
    try {
      const receipt = await command("receipt", { id: round.id });
      const url = URL.createObjectURL(
        new Blob(
          [JSON.stringify({ ...receipt, settlement: binding }, null, 2)],
          { type: "application/json" },
        ),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `fiber-mines-${round.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt unavailable.");
    }
  }
  const complete =
    binding?.closeStatus === "confirmed" &&
    binding?.proofStatus === "confirmed";
  const proofCellCapacity = binding
    ? BigInt(73 + (binding.closeScript.args.length - 2) / 2) * 100_000_000n
    : 0n;
  return (
    <section
      className={`panel settlement-panel ${complete ? "settlement-complete" : ""}`}
      aria-label="On-chain settlement"
    >
      <div className="panel-heading">
        <span className="step">03</span>
        <h2>{complete ? "✓ SETTLED ON TESTNET" : "SETTLEMENT & PROOF"}</h2>
        <span className="receipt-badge">
          {demo ? "PRACTICE" : complete ? "VERIFIED" : "CKB TESTNET"}
        </span>
      </div>
      <ol className="settlement-steps">
        <li className={terminal ? "done" : ""}>
          <b>01</b>
          <span>Finish round</span>
        </li>
        <li
          className={
            terminal &&
            (round?.payment === "PAYOUT_PAID" || round?.game === "LOST")
              ? "done"
              : ""
          }
        >
          <b>02</b>
          <span>Fiber payout</span>
        </li>
        <li className={binding?.closeStatus === "confirmed" ? "done" : ""}>
          <b>03</b>
          <span>Close to wallet</span>
        </li>
        <li className={binding?.proofStatus === "confirmed" ? "done" : ""}>
          <b>04</b>
          <span>On-chain proof</span>
        </li>
      </ol>
      {demo ? (
        <p className="muted">
          Practice rounds use demo credits. Switch the server to Fiber Testnet
          to settle CKB and publish real evidence.
        </p>
      ) : !binding ? (
        <p className="muted">
          Connect your wallet and open a round channel. Your closing transaction
          and game proof will appear here.
        </p>
      ) : (
        <>
          <dl className="receipt-facts">
            <div>
              <dt>Round</dt>
              <dd>{round!.id.slice(0, 8)}</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>{binding.channelId.slice(0, 12)}…</dd>
            </div>
            <div>
              <dt>Wallet return</dt>
              <dd>
                {binding.returnedAmount
                  ? `${formatCkb(binding.returnedAmount)} CKB`
                  : "Awaiting close transaction"}
              </dd>
            </div>
            <div>
              <dt>Chain status</dt>
              <dd>
                {binding.closeStatus || "Channel open"}
                {binding.closeBlockHash ? " · included in block" : ""}
              </dd>
            </div>
          </dl>
          <p className="muted">
            The return includes remaining channel funds and any reward, less
            network fees. Pending funds are shown separately until CKB confirms
            them.
          </p>
          {binding.closeTxHash && (
            <a
              className="chain-link"
              href={explorer(binding.closeTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              ↗ Closing transaction · {binding.closeTxHash.slice(0, 16)}…
            </a>
          )}
          {binding.proofTxHash && (
            <a
              className="chain-link"
              href={explorer(binding.proofTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              ↗ Game proof · {binding.proofStatus} ·{" "}
              {binding.proofTxHash.slice(0, 16)}…
            </a>
          )}
          {terminal && (
            <>
              <label className="auto-close">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(event) => setAuto(event.target.checked)}
                />
                Auto claim & cooperatively close after this round
              </label>
              <div className="settlement-actions">
                <button
                  disabled={working}
                  onClick={() => {
                    void advance();
                  }}
                >
                  {working
                    ? "Checking settlement…"
                    : binding.closeTxHash
                      ? "Refresh confirmation"
                      : "Claim & close channel"}
                </button>
                {binding.closeTxHash && (
                  <>
                    <button
                      disabled={
                        working ||
                        !account ||
                        binding.proofStatus === "confirmed"
                      }
                      onClick={() => {
                        void publishProof();
                      }}
                    >
                      {binding.proofTxHash
                        ? "Check game proof"
                        : "Publish game proof in wallet"}
                    </button>
                    <button
                      onClick={() => {
                        void downloadReceipt();
                      }}
                    >
                      Download receipt
                    </button>
                  </>
                )}
              </div>
              {binding.closeTxHash && !binding.proofTxHash && (
                <p className="muted">
                  Publishing stores the receipt SHA-256 digest in a cell owned
                  by your wallet. The cell holds {formatCkb(proofCellCapacity)}{" "}
                  CKB of your capacity, plus a network fee; review both in your
                  wallet. Download the receipt to independently verify the board
                  and digest.
                </p>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="settlement-error break">
          {error}
        </p>
      )}
    </section>
  );
}
