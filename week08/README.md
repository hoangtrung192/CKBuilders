# Fiber Mines — CKB Testnet

Fiber Mines is a 3×3 mines game using CKB Testnet and Fiber payment channels. The app runs the game state machine on its server; PLAYER pays each stake through Fiber, HOUSE pays a successful cashout, and the round channel is cooperatively closed back to the wallet that funded it.

**Testnet transactions are real chain/payment-channel operations.** Keep channel funds, the browser Fiber identity, the HOUSE node database, and the app's `data/` directory intact while a payment or channel close is pending. Never paste wallet seeds, private keys, node passwords, RPC tokens, or `.env.local` contents into chat or commit them.

## Current Testnet status

Checked on 2026-11-05 in the open browser and local HOUSE node:

- The latest visible round (`ddcf4bea`) used a 10 CKB stake and ended on a mine. Its result is a loss; gross payout is 0 CKB.
- Its settlement panel still says `closing` / `Awaiting close transaction` and asks to unlock the same PLAYER Fiber node before claiming and closing. The page blocks a new channel until this settlement is resolved.
- The HOUSE FNN CLI currently reports 1 peer and 0 channels. The browser's channel panel also shows no playable round channel.
- The seven screenshots in [evidence/](evidence/) record the node, app, setup and game UI. They do not prove an on-chain close or successful Fiber payment; see [Week08.md](Week08.md) for an image-by-image assessment.

**Do not start another round yet.** Unlock the original PLAYER node in the same Chrome profile with its existing password, then use **Claim & close channel** for the pending round. Reconcile the HOUSE and PLAYER channel lists and the CKB transaction before trying again. Do not clear browser storage or open a replacement channel while the close result is unknown.

## Requirements and local run

- Windows PowerShell
- Node.js 22.16 or newer
- pnpm 10.11 or newer
- A CKB Testnet wallet extension
- A running Fiber Testnet HOUSE node with an RPC endpoint for the server and a reachable peer endpoint for the browser

From `G:\neon\week08`:

```powershell
pnpm install
Copy-Item .env.example .env.local
# Edit .env.local in a local editor; do not publish its values.
pnpm dev
```

Open <http://localhost:3000>. Keep the terminal running. If PowerShell blocks `pnpm.ps1`, use `pnpm.cmd` for the same commands. Set `PAYMENT_MODE=fiber` for Testnet; the app does not silently switch to mock credits. Set `PAYMENT_MODE=mock` only when deliberately practicing without Testnet payments.

## HOUSE configuration

Keep the HOUSE private key in the Fiber node's protected configuration. Keep administrative RPC on loopback/private networking or behind an authenticated tunnel. A browser needs the HOUSE P2P peer address; it must not receive the HOUSE RPC URL or token.

The app reads these server-side values from `.env.local`:

| Variable | Purpose |
| --- | --- |
| `PAYMENT_MODE` | `fiber` for CKB Testnet; `mock` for practice. |
| `FIBER_RPC_URL` | Private HOUSE JSON-RPC endpoint, such as a loopback endpoint when app and node share a computer. |
| `FIBER_RPC_TOKEN` | Optional HOUSE RPC bearer token. |
| `FIBER_HOUSE_PUBKEY` | Expected HOUSE Fiber public key. |
| `FIBER_PEER_ADDRESS` | Browser-reachable HOUSE peer multiaddress. Use WSS when the browser connects over the internet; local WS works only when both endpoints can reach that local node. |
| `FIBER_HOUSE_BUDGET_CKB` | Spendable HOUSE outbound channel allocation reserved for this app. Keep it at or below actual outbound liquidity. |
| `FIBER_FEE_BUDGET_CKB` | Payout routing fee reserve/cap; default is 0.1 CKB. |
| `MAX_STAKE_CKB` | Maximum stake accepted by the app. |
| `HOUSE_EDGE_BPS` | House edge in basis points; 200 means 2%. |
| `DATA_DIR` | Persistent server database directory; default `./data`. |
| `CKB_TESTNET_RPC_URL` | Public Testnet RPC used for independent settlement checks. |

For a 10 CKB maximum stake, 2% edge, and 0.1 CKB fee reserve, configure HOUSE with at least **352.9 CKB of usable outbound channel liquidity** for the app's maximum 352.8 CKB gross payout plus fee reserve. The number in `FIBER_HOUSE_BUDGET_CKB` is an accounting limit; setting it does not add liquidity. Wallet on-chain CKB is not channel liquidity. Confirm the channel is ready and directional balances are correct before enabling play.

Restart the Next.js server after editing `.env.local`. Do not put HOUSE values in `NEXT_PUBLIC_*` variables.

## Start and check the Fiber node

In a separate PowerShell window, start the HOUSE node and leave it running:

```powershell
Set-Location "$HOME\.fiber"
.\start-node.ps1
```

In another PowerShell window, read its status:

```powershell
Set-Location "$HOME\.fiber"
.\fnn-cli.exe info
.\fnn-cli.exe peer list_peers
.\fnn-cli.exe channel list_channels
```

Before play, confirm the network is CKB Testnet, the expected HOUSE pubkey is shown, the peer is connected, and the required channel is `ChannelReady` with sufficient outbound liquidity. In the app's **Thiết lập Fiber Testnet** panel, use **Kiểm tra HOUSE node** and **Kiểm tra kênh / liquidity PLAYER** to compare the app's view. If a channel-opening or payment request has an unknown result, inspect both nodes and the relevant payment/channel hash before retrying.

## Player setup and a round

1. Connect the CKB Testnet wallet that will fund the round channel. Its lock is the return destination for that channel.
2. In **Thiết lập Fiber Testnet**, unlock the existing browser PLAYER Fiber identity with its original local password. The identity is stored in this browser profile's IndexedDB; keep using the same profile and origin. The password is not the wallet seed phrase.
3. Connect the PLAYER node to the HOUSE peer. Check the specific channel's state and direction balances. HOUSE needs enough outbound liquidity to pay a winning cashout.
4. Finish any previous round's settlement before opening a new round channel. Each round channel is tied to the wallet that funded it and is closed after that round.
5. Open a round channel in the setup panel. Click **Prepare round channel funding** once; when the button changes to **Sign prepared funding transaction**, click it and approve the channel-funding transaction in the wallet. Wait for `CHANNEL_READY`.
6. For a 10 CKB stake, set HOUSE liquidity to 352.9 CKB. Click **Tạo invoice HOUSE mới**, then **Pay HOUSE liquidity from PLAYER**. Check the directional balances before play. The invoice is created by the app and expires after one hour.
7. Start a round. The app creates a server commitment and automatically fills a random client seed. Review the 10 CKB stake and click **Xác nhận & bắt đầu** only when ready; this sends a Testnet Fiber payment. The board becomes playable after HOUSE reports the matching stake invoice as paid.
8. Reveal cells. Cash out after a safe pick to request the payout, or keep playing. Hitting a mine loses the stake. Seven safe picks cash out automatically.
9. Wait for payout and cooperative channel close. The return is shown as pending until the CKB transaction is confirmed. Download and verify the receipt only after settlement completes.

## Pending payments and channel recovery

- A slow or unknown request is not proof that it failed. Use the app's status/reconcile controls and inspect the same payment hash with `getPayment`/`getInvoice`; do not send a replacement payment or open another channel while status is uncertain.
- If the game says **Unlock the same Fiber node**, unlock the original PLAYER identity in the same browser profile, then use **Claim & close channel**. Keep the node online while the cooperative close completes.
- If the page says **Finish settlement of the previous round before opening a new channel**, resolve that round's close first. Check `fnn-cli.exe channel list_channels` and the CKB transaction status. Pending return funds are not spendable channel balance.
- Preserve browser IndexedDB/localStorage, the HOUSE node database, and the full `data/` directory (including SQLite WAL files). Do not run the same Fiber identity concurrently in another tab or delete browser data while a channel/payment is pending.
- A round losing on a mine has no payout, but still requires its channel settlement/close to finish. A screenshot or app message alone is not proof of CKB confirmation.

## Project checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Tests use local fixtures and do not prove a funded Testnet stake, payout, or channel close. Only claim those operations as complete after checking the Fiber payment statuses and the CKB Testnet transaction.

## Evidence

- [Week08 weekly report](Week08.md) — summary of the work, current Testnet status and recommended evidence captures.
- [Evidence screenshots](evidence/) — seven captures of the node, UI, Fiber setup, game and history. None shows a confirmed settlement transaction.

See [docs/TESTNET_SETUP.md](docs/TESTNET_SETUP.md) for additional operator notes and [docs/WEEK08_REPORT.md](docs/WEEK08_REPORT.md) for implementation/check history.
