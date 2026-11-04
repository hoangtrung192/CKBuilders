"use client";
import { ccc } from "@ckb-ccc/connector-react";
import { useRef } from "react";
import { formatCkb } from "../lib/money";
import { useWalletAccount } from "./wallet-account";

export function ExternalWallet({ onSetup }: { onSetup: () => void }) {
  const { open, disconnect, wallet } = ccc.useCcc();
  const signer = ccc.useSigner();
  const { account, error, refresh } = useWalletAccount();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="wallet-connect"
        onClick={() => {
          if (signer) dialog.current?.showModal();
          else open();
        }}
      >
        {signer
          ? account
            ? `◈ ${formatCkb(account.balance)} CKB · ${account.address.slice(0, 7)}…${account.address.slice(-5)}`
            : "Wallet connected"
          : "Connect Wallet"}
      </button>
      <dialog
        ref={dialog}
        className="external-wallet"
        aria-labelledby="external-wallet-title"
      >
        <div className="wallet-dialog-heading">
          <h2 id="external-wallet-title">
            {wallet?.name || "Your wallet"} · Testnet
          </h2>
          <button
            aria-label="Close wallet"
            onClick={() => dialog.current?.close()}
          >
            ✕
          </button>
        </div>
        <label>Connected account</label>
        <code className="break">{account?.address || "Loading…"}</code>
        <p>
          On-chain balance:{" "}
          <strong>{account ? formatCkb(account.balance) : "—"} CKB</strong>
        </p>
        <p>
          Your wallet signs the funding transaction for the round. Fiber handles
          stake and reward payments. Closing the channel returns remaining funds
          directly to this wallet.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          onClick={() => {
            void refresh();
          }}
        >
          Refresh balance
        </button>
        <button
          onClick={() => {
            dialog.current?.close();
            open();
          }}
        >
          Change wallet
        </button>
        <button
          onClick={() => {
            disconnect();
            dialog.current?.close();
          }}
        >
          Disconnect
        </button>
        <button
          className="primary"
          onClick={() => {
            dialog.current?.close();
            onSetup();
          }}
        >
          Set up round channel
        </button>
      </dialog>
    </>
  );
}
