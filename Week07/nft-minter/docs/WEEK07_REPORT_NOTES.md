# Week07 factual report notes

## User-requested Testnet migration — 2026-10-28

The user explicitly changed scope to public CKB Testnet so new transactions can be inspected on the public explorer. The current default app is now Testnet, with CCC connector-react 2.2.2, a Testnet-only wallet picker, wallet signing, faucet/address links and transaction explorer links. The original demo is kept in `src/DevnetApp.tsx` and `README.devnet.md`. No Devnet keys are used in Testnet mode; the old ignored environment file was backed up as `.env.devnet.local` and active `.env.local` contains no signing keys.

Public Testnet identity and genesis were independently verified via `https://testnet.ckb.dev/` and `https://testnet.ckbapp.dev/`. Both returned genesis `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`; chain name is `ckb_testnet`. The Vite proxy also returned `ckb_testnet` after the configuration change.

SDK Spore code hash: `0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d`, `data1`. Deployment transaction `0x5e8d2a517d50fd4bb4d01737a7952a1f1d35c8afc77240695bb569cd7d9d5a1f`, output 0, was committed; its live bytes matched the code hash. This is upstream deployment evidence, **not** a user mint. Details are in `../evidence/testnet-diagnostics.json`.

TypeScript/build with the wallet connector passed. The final unit run passed **13/13 tests**, including no broadcast after wallet account changes or mutation of the reviewed raw transaction. Public Testnet signing is blocked without an external wallet, or on a client/chain/genesis mismatch. Signed raw hash, sender and fee must match the review before broadcast. Wallet account changes invalidate stale reviews. Collection and balances can include all locks exposed by the connected signer. HTTP checks returned 200 for the live app and Testnet component, and the same-origin proxy returned `ckb_testnet`.

No newly minted/transferred user Testnet asset is claimed: the user must connect a wallet, obtain Testnet CKB from the faucet and approve the signature in that wallet. Historical successful local transactions below remain Devnet-only. User wallet approval was not automated or bypassed.

## Original Devnet implementation and evidence (historical)

Project: **CKB NFT Minter**. Owner for this Week07 deliverable: **Trung Do**, as specified in the handoff. Earlier weeks contain another owner name and remain untouched. No learning reflections, time spent or handbook completion are inferred.

## Implemented

- Isolated React/TypeScript/Vite 6 application under `Week07/nft-minter`, with exact dependency versions and independent lockfile.
- Local OffCKB RPC discovery, live system/Spore deployment export, genesis pinning, runtime signer guards, two public funded demo accounts and loopback Vite proxy.
- Text/PNG/JPEG input validation and exact preview, real finalized-transaction cost review, standalone Spore minting, live collection/detail, genuine transfer and post-commit owner/content verification.
- Status tracking, duplicate submission/account-switch protection, persistent latest hash, unknown/pending recheck, safe rendering, object URL cleanup and bigint CKB amounts.
- Read-only diagnostics, opt-in transaction smoke script, subsequent readback/guard checks, eight meaningful unit tests and reproduction/evidence documentation.

## Observed environment and decisions

The intended Week07 scaffold did not exist. No AGENTS.md was found in the inspected workspace/ancestor locations. Existing unrelated edits and previous weeks were preserved. Node 22.16.0 was available; global pnpm 12.4.1 and OffCKB 0.4.13 existed under `%APPDATA%\npm` but were missing from the agent shell PATH. Explicit `.cmd` paths resolved this without system changes.

Neither RPC port was reachable initially. `offckb node --daemon` started the existing Devnet and passed its health check; no reset/cleanup was run. The actual selected endpoint was `http://127.0.0.1:28114`, chain `ckb_dev`. The Vite `/rpc` proxy was successfully queried. Actual dev URL: `http://127.0.0.1:5173/`.

Installed package types showed that this CCC version uses immutable private known-script storage. The client was changed to receive known scripts through its constructor configuration. The signer also needs AnyoneCanPay information for address enumeration; the configuration includes OffCKB's known-script exports. No old shortened hashes or Testnet deployment assumptions were used.

Spore code hash: `0x7e8bf78a62232caa2f5d47e691e8db1a90d05e93dc6828ad3cb935c01ec6d208`, hash type `data2`. Dependency: transaction `0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7`, output 10. Configuration comes from OffCKB and is checked against live code bytes before signer use.

## Executed verification (2026-10-28)

1. `pnpm configure` and `pnpm diagnose`: passed; both funded addresses and capacity breakdowns observed, keys hidden.
2. `pnpm smoke --text-only`: passed; mint committed, 47 identical UTF-8 bytes queried back. Hash `0xc0e55992617bf05487fdba0557b16aa66af1c224f145308693e002e7dc98e26b`; Spore ID `0xe0e34fba784529d7ba0ee75749aafb7943f2b9f3102018839288d957bd8837a9`; fee 956 shannons.
3. `pnpm smoke`: passed; second text mint hash `0x2fe27b6077cf24ad3dd095a377d0b37508ae569f66e1cb3f891ddbbadcc07572`, ID `0xba64e1aab178c428bdfc6552b7b65c13e15ae745d5bca7e6340ca5a8adca8b03`, 47 bytes, fee 956 shannons.
4. PNG mint hash `0x5ed3da8aed37cf1a7bb42c6d63caa2774b72ca91e4dbc47bcd5f25bb4e3ed4fe`, ID `0x0255c826dc4dc5fb81ea054b1f5e6aed574b2ed27d491668bd826b22fa6656c1`, committed, 68 original bytes matched readback, fee 976 shannons.
5. A-to-B transfer hash `0x731fd993861cd5b1c89847942c0f2f066b6208142b706d20b248926b4288ff32`, committed. ID and full serialized data unchanged; A absent/B present verified.
6. `pnpm check:chain`: passed; fresh independent collection reconstruction, non-owner transfer rejection and wrong-genesis signer blocking.
7. `pnpm test`: 8 tests passed, 0 failed.
8. `pnpm build`: TypeScript and Vite passed. Non-blocking large SDK chunk warning remains.
9. Chrome accessibility confirmed Node ready, actual A address/balances, text and PNG collection, and a 32-byte typed text with the same preview. UI mint/transfer confirmation clicks were not completed.

Machine-readable observations are in `../evidence/text-smoke.json`, `../evidence/chain-smoke.json` and `../evidence/chain-readback.json`. These are historical records tied to the recorded genesis, not guarantees of future live state.

## Milestone status

| Milestone | Status |
| --- | --- |
| M1 / 20% | Verified: workspace, app start, RPC and A/B accounts |
| M2 / 35% | Verified: committed script text mint and identical chain readback |
| M3 / 50% | Implemented: validation, preview and real capacity/fee review; tests and service checks passed |
| M4 / 65% | Not yet verified: UI-originated mint and committed detail capture |
| M5 / 80% | Script chain transfer/collection verified; complete browser flow remains pending |
| M6 / 90% | Unit tests/build and several chain error paths passed; manual UI checks remain |
| M7 / 100% | README and evidence instructions complete; UI acceptance/screenshots still required |

Do not report 100% acceptance. The cumulative verified checkpoint remains M3 / 50% until M4 is demonstrated, although later script/tests/docs work is already complete.

## Remaining work / exact blocker

The browser tab host was unavailable. Native Windows accessibility allowed reading the UI and setting the text input, but click automation returned `coordinate input geometry is unavailable`; screenshot capture showed a VS Code window instead of the selected Chrome window even after window reselection and Raise. No screenshots were saved or represented as successful evidence.

Manually execute the review/confirm mint and A-to-B transfer steps and capture the specific screenshots listed in `EVIDENCE.md`. Also verify image decodability errors, responsive layout, keyboard/copy/modal behavior and collection after browser reload. Chain service operations are already verified; do not describe script-originated transactions as UI-originated.

No git commit, push, remote publishing, external deployment, real private-key access or edits to older assignments were performed.
