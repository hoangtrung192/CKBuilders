# Live CKB Testnet play

The application does not provision HOUSE liquidity. A local `.env.local` and a HOUSE node have been used in this workspace; keep their private values on the machine. The latest check on 2026-11-05 found the HOUSE FNN node with one peer and zero channels. The browser showed round `ddcf4bea` as a 10 CKB mine loss with channel settlement still `closing` / `Awaiting close transaction`. The screenshot in `../evidence/fiber-round-settlement-pending.jpg` records that UI state only; it is not proof that a close transaction was confirmed.

## HOUSE operator

1. Run a native Fiber Testnet node compatible with the installed `@nervosnetwork/fiber-js` 0.9.1. Keep its private key in its own protected configuration. Use the official [browser and external funding guide](https://www.fiber.world/docs/build/sdk/wasm-node) and [channel RPC reference](https://www.fiber.world/docs/api-reference/channels/channel).
2. Fund the HOUSE Testnet on-chain address. Expose a browser-reachable WSS peer endpoint; keep its administrative RPC on loopback/private network or an authenticated tunnel. For local development only, a reachable WS peer is also usable from localhost.
3. Accept each PLAYER round channel with enough HOUSE contribution for the maximum reward. The app does not create this liquidity. For a 10 CKB stake with a 2% edge, the maximum payout is 352.8 CKB, plus the configured payout fee reserve. The default editable 499 CKB channel amount is the PLAYER contribution, not HOUSE liquidity or a universal peer minimum. Review your node's acceptance policy and external funding timeout.
4. Copy `.env.example` to `.env.local`, set `PAYMENT_MODE=fiber`, and fill in `FIBER_RPC_URL`, optional `FIBER_RPC_TOKEN`, `FIBER_HOUSE_PUBKEY`, and `FIBER_PEER_ADDRESS`. Set `FIBER_HOUSE_BUDGET_CKB` no higher than the actual HOUSE outbound channel allocation dedicated to this application. For an initial 10 CKB stake limit, `MAX_STAKE_CKB=10` and a 500 CKB HOUSE allocation are a possible configuration if that channel really has the corresponding liquidity. Replenish on-chain HOUSE funds as channels are reopened.
5. Restart the app. **Kiểm tra HOUSE node** checks Testnet genesis, expected HOUSE public key and channel balances. Starting a real round additionally checks that this specific PLAYER channel has enough liquidity in both directions. Public peer connectivity alone is insufficient.

## Player

1. Open localhost or HTTPS and choose **Connect Wallet**. Select your external wallet and approve its Testnet connection. The header and HUD display the wallet's queried on-chain CKB balance.
   The main page uses document isolation for modern Chromium while preserving popup-wallet communication. If Fiber startup reports missing isolation, use `/compat` with an extension wallet; that page uses COOP/COEP isolation and can block popup-based wallets.
2. Open **Set up Fiber payments**. Create or unlock the browser Fiber identity with the same node password used on this origin. This password belongs to the local Fiber identity; never enter your external wallet seed phrase or private key.
3. Enter the round channel funding amount and choose **Open / resume round channel in wallet**. Review and sign the actual channel funding transaction in the wallet. The shutdown script is set to this wallet's lock. Do not alter the negotiated inputs, outputs or order. The HOUSE operator must accept the channel with return liquidity.
4. Wait for `CHANNEL_READY` and the playable HUD balance. Receive the commitment, choose a client seed and confirm the stake. The app pays the fixed Fiber invoice and activates the board only after the backend observes Paid. A payment with an unknown result is reconciled by hash, not sent again.
5. Play the gem grid. Cash out after a safe pick or finish by finding a mine. Auto claim and close is enabled in the settlement panel. A win must reach HOUSE payer Success before cooperative close can proceed; pending TLCs also block closing. Keep the browser node online. If automatic settlement stops, unlock the original node and use **Claim & close channel** to retry.
6. Follow the actual closing transaction in the Testnet explorer. The server checks the Testnet chain, the spent funding outpoint, the return wallet lock and returned CKB capacity. The pending return is separate from the queried wallet balance. After transaction inclusion, the wallet balance refreshes from the network. Returned CKB includes remaining channel principal and any reward, less fees.
7. Choose **Publish game proof in wallet** and review the extra transaction. This stores a 32-byte SHA-256 digest of the canonical game receipt in a cell owned by your wallet. For a standard 20-byte-args lock, the cell needs 93 CKB capacity; other wallet locks can need more. That capacity remains in your own cell, and the transaction also pays a network fee. The receipt contains the revealed seed, client seed, board, stake/payout hashes, channel funding outpoint, wallet, and closing transaction hash.
8. After the close and game proof transactions are included in Testnet blocks, the receipt displays **SETTLED ON TESTNET**. Download the JSON and verify it independently:

```powershell
pnpm.cmd verify:receipt C:\path\to\fiber-mines-round.json
```

The verifier checks the seed commitment, board, payout arithmetic, funding-cell spend, return lock and anchored digest against CKB Testnet. The game remains server-operated: the digest records the result; it is not an on-chain contract that forces a payout. Closing alone proves settlement, and the separate result anchor proves the receipt bytes were published.

## Recovery and limits

- Keep the browser's IndexedDB, localStorage and node password. Do not run the same node in two tabs. Wallet disconnect does not erase a round or change its return address.
- A channel is permanently bound to one round. New play requires the previous channel's close to be confirmed and a fresh funded channel. This deliberately adds on-chain transactions and fees for each round.
- A funding negotiation with an unknown result is blocked from silently opening another channel. Inspect PLAYER and HOUSE before operator recovery. Existing signed attempts and proof transaction hashes remain saved locally.
- Cooperative closing needs the HOUSE online. This UI does not issue force-close commands or hide unconfirmed funds behind a spendable balance.
- Receipts and reserves are persistent, but polling depends on keeping the app open. There is no always-on browser node or background operator reconciler.
- The current browser evidence shows a completed 10 CKB game round that lost on a mine, followed by a pending channel close. It does not establish the Fiber stake payment status or CKB close confirmation by itself. Check both nodes and the Testnet transaction before treating settlement as complete. No winning payout or result-proof transaction is claimed for this round.
