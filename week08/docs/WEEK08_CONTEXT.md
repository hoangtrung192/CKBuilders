# Week08 context

Owner: Daniel (Git identity).

The source instruction was read from `C:\Users\ANV15-51\Downloads\WEEK08_CODEX_PROMPT.txt`. This workspace was initially empty. No applicable existing AGENTS.md or lockfile was found in it or its ancestor project folders before creation. Next.js generated its own AGENTS.md after development startup; the installed route-handler and client-component guides were then read.

The assignment is a standalone Next.js/React/strict TypeScript CKB Testnet game, Fiber Mines. Prior weeks must remain untouched. Scope is PLAYER gameplay and a privately funded HOUSE, not a community pool.

Required gameplay: nine fixed cells, two mines, seven safe cells; exact bigint shannon arithmetic; 2% configurable house edge; cashout only after one safe cell; auto cashout at seven; one pending/active round per session; server validation of all outcomes. Default mock must work without keys and clearly identify demo credits. Fiber has separate storage and never falls back to mock.

Required fairness: server CSPRNG; commitment delivered before client seed/stake; immutable seed pair/nonce/algorithm before invoice payment; unbiased HMAC-SHA256 shuffle; reveal only at round end; independent verifier; no claim of trustless settlement.

Required payments: fixed HOUSE stake invoice; backend verification of HOUSE Paid; immutable gross payout debt; round-bound PLAYER receiving invoice with exact currency/amount/expiry/hash/recipient; HOUSE payer Success and separately observed PLAYER Paid; reserves for worst-case obligations and routing fees; persistent attempts; no resend based only on a timeout; debt survives errors/restarts.

Deliverables: Vietnamese responsive UI, keyboard-playable board, history/payment details, seed verification, node/channel/liquidity setup, demo-only reset, English README, execution report and truthful evidence. The assignment is not 100% complete until a funded Testnet round and settlement have actually run.

Current implementation uses Next.js 16.4.5, React 19.2.0, SDK 0.3.3, fiber-js 0.9.1 and Node 22's built-in SQLite. Mock is operational; browser WASM startup has been demonstrated. No HOUSE RPC/node credentials, funded channels, or authority to operate a funded HOUSE were supplied. Continue with real Testnet setup and end-to-end evidence when those exist. Keep private keys out of chat and source control.
