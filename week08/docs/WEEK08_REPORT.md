# Week08 execution report

## Follow-up: 2026-11-05

Added real external wallet selection and balance reads, direct wallet-signed channel funding with immutable transaction checks and recovery, a dedicated channel per round, automatic payout-before-close coordination, verified closing receipts, wallet-signed on-chain result digests, and an independent receipt CLI. The arcade UI now separates on-chain wallet balance, playable channel balance and pending wallet return.

Validation: production build and lint pass; 24 unit tests pass, including funding mutation/timeout protection and settlement verification. Browser checks pass for the wallet selector, simulated external provider/balance and pending-to-confirmed receipt behavior, practice gameplay, reload identity recovery, desktop/mobile layout, WASM isolation and cross-origin popup messaging. The provider/chain fixtures are simulations; no live wallet signature, funding, stake, payout, close or result-anchor transaction has been demonstrated.

Live acceptance is still incomplete. On 2026-11-05, the open app showed a 10 CKB round ending in a mine loss and a channel close still pending; the local HOUSE CLI showed one peer and zero channels. The current state and safe recovery steps are recorded in [live Testnet setup and receipt verification](TESTNET_SETUP.md). No successful close or winning payout is verified.

## Original assessment: 2026-11-04

Owner: **Daniel** (Git identity). Date: **2026-11-04**, Windows / PowerShell, Node **22.16.0**.

**Overall assignment: approximately 75%, not 100%.** The mock application is playable and verified. Fiber SDK integration and setup controls are implemented, but no funded HOUSE node/channel or payment authorization was available, so **no real Testnet stake, routing fee, payout, or payment proof has been verified**.

## Delivery status

| Area                                                                                  | Status                             | Evidence / remaining work                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Standalone Next.js / React / strict TypeScript / pnpm project                         | Done                               | Created only inside `G:\neon\week08`; own package and lockfile                                        |
| Server-owned fixed 3×3 board, exactly 2 mines                                         | Done                               | Deterministic fixtures, CSPRNG runtime seeds, no production override                                  |
| Exact bigint payout and configurable house edge                                       | Done                               | All seven default multipliers tested, 10 → 12.6 example                                               |
| Stake, safe reveals, mine loss, cashout, automatic seventh-cell cashout               | Done                               | Backend tests and actual Chromium mock play                                                           |
| SQLite persistence, financial transactions, active-round/payment uniqueness           | Done                               | Concurrent requests and actual server process restart tested                                          |
| Session ownership and same-origin mutations                                           | Done                               | Backend and HTTP checks                                                                               |
| Commit before stake, client seed after commit, unbiased shuffle, independent verifier | Done                               | Node/Web Crypto agreement and actual browser verification                                             |
| Vietnamese responsive UI, history, invoice/payment details, demo reset                | Done                               | Desktop 1440px and mobile 390px browser checks; screenshots below                                     |
| Loading, error, empty state, keyboard buttons, reduced motion                         | Implemented                        | Native accessible buttons and focus styles; no dedicated screen-reader audit                          |
| Mock/Fiber database and balance separation; no fallback                               | Done                               | Separate SQLite paths; Fiber missing-config HTTP test shows no demo balance                           |
| HOUSE setup and private RPC adapter                                                   | Implemented, configured locally    | Latest CLI check: one peer, zero channels; no spendable HOUSE channel currently reported              |
| Browser Fiber WASM startup                                                            | Executed                           | Local Testnet node started in Chromium; the same public key was restored after reload; no funds moved |
| HOUSE invoice creation and verification of receiver Paid                              | Implemented, unverified on Testnet | Requires funded configured HOUSE and PLAYER channels                                                  |
| Locked payout invoice validation, HOUSE payer Success, PLAYER receiver Paid           | Implemented, unverified on Testnet | Browser observes receiver independently; no fabricated receipt                                        |
| Reserve and fee budgets; unknown/failed payout debt preservation                      | Done in local tests                | Pending payout survives timeout, SQLite reopen and repeated reconciliation                            |
| Automatic retry/refund of terminal failures and orphan creation intents               | Pending operational workflow       | Deliberately retains obligations instead of guessing or resending; see README                         |
| End-to-end funded Testnet settlement                                                  | Incomplete                         | Browser shows a 10 CKB mine loss and close pending; payment status and on-chain close are not verified |

## Checks actually run

| Command / check                  | Result                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                   | Passed; lockfile generated. pnpm noted an ignored esbuild lifecycle script; installed binaries ran tests successfully.                                                                   |
| `pnpm typecheck`                 | Passed                                                                                                                                                                                   |
| `pnpm lint`                      | Passed with no remaining errors/warnings                                                                                                                                                 |
| `pnpm test`                      | **15/15 passed**                                                                                                                                                                         |
| `pnpm build`                     | Passed: static `/`, dynamic Node `/api/game`                                                                                                                                             |
| `node scripts/api-check.mjs`     | Passed: concurrent start debits once, duplicate reveal rejected, ownership enforced, foreign origin rejected, actual process restart restores state, unconfigured Fiber never falls back |
| `node scripts/browser-check.mjs` | Mock play, commitment secrecy, terminal reveal verification, reload persistence, mobile overflow and cross-origin isolation passed; no page JS errors                                    |
| Chromium WASM node               | Passed: local startup and same-public-key recovery after page reload, on the production build                                                                                            |
| Actual Testnet round             | **Partially observed** — 10 CKB round shows mine loss; no payout was due, close is still pending, and payment/close hashes were not independently verified                                  |

Node 22 emits its expected `node:sqlite` experimental warning. Earlier first-pass failures (ESM package setup and React lint checks) were corrected before the passing checks above. No build error is being treated as success.

The production HTTP check starts fresh temporary servers on 3001/3002 and uses separate databases under ignored `artifacts/http-*`. The restart check stops and starts the actual Next process. The payout-debt test independently closes and reopens a file-backed SQLite database, reconciles the old hash, and checks that no second send or credit occurs.

## Real evidence files

- [Live Testnet round with pending close](../evidence/fiber-round-settlement-pending.jpg): current app screenshot; shows the game result and the unresolved close state, not a successful transaction.

Generated locally by Playwright; no synthetic images or invented payments:

- [Desktop mock game](../artifacts/desktop.png): actual terminal round, board reveal and history.
- [Mobile mock game](../artifacts/mobile.png): actual 390px viewport with no horizontal overflow.
- [Browser check output](../artifacts/browser-result.json).
- [Unfunded PLAYER WASM node](../artifacts/wasm-node.png): real Testnet node pubkey and funding address, without a payment claim.
- [Production API check output](../artifacts/api-result.json).

`artifacts/` is ignored by Git and contains disposable test databases and SDK source inspected during implementation. Keep the PNGs when collecting assignment evidence. The initial desktop run demonstrated a 10-credit stake and 12.6-credit gross cashout, with a 1,002.6-credit final demo balance. Repeated browser checks generate fresh random rounds, so their latest screenshots may show a different board or a mine loss.

The final successful production browser check started a real local WASM node, reloaded the page, unlocked it with the same disposable test password and confirmed the same public key. It also exposed a mismatch between SDK types and runtime: compressed public keys are returned without `0x`. The app now canonicalizes those values, verified against the v0.9.1 JSON types. Earlier `wasm-failure.png` diagnostics were caused by a test selector requiring `0x`; they are not payment evidence or the final result.

Still to capture using real Testnet operations:

1. HOUSE and PLAYER pubkeys/funding addresses, peer connection, ready channel and both directional balances (public information only).
2. Stake invoice with fixed amount, PLAYER payer **Success**, HOUSE receiver **Paid**, and matching hash.
3. Locked payout amount, PLAYER receiving invoice, HOUSE payer **Success**, PLAYER receiver **Paid**, actual routing fees and matching hash.
4. Post-reload history and an actual pending-payment reconciliation, without sending twice.

## Demo instructions and continuation

Run `pnpm dev`, open http://localhost:3000, and capture the board after a reveal, a cashout/loss, history, verifier, and mobile layout. The app is usable without secrets. See the English [README](../README.md) for PowerShell commands, exact algorithm, environment variables, funding/channel setup and manual recovery boundaries.

To continue Testnet validation, configure the private HOUSE RPC and expected pubkey locally, expose a reachable WSS peer, allocate funded channel liquidity in both directions, set conservative HOUSE/fee budgets, explicitly select `PAYMENT_MODE=fiber`, and restart. Do not provide private keys in chat. A standalone CKB address is insufficient to settle Fiber invoices. No mainnet action was performed.
