# CKB NFT Minter — historical Devnet mode

The app now defaults to CKB public Testnet following the user's request. See [current README](README.md). This document preserves the original local Devnet workflow and its historical validation results; they are not Testnet results. Run `pnpm configure` to explicitly return to local Devnet, or `pnpm configure:testnet` to return to public Testnet.

Owner: **Trung Do** (Week07 specification). This project is separate from all previous weeks.

An educational React/TypeScript application for creating, viewing and transferring standalone Spore digital objects on a local Nervos CKB OffCKB Devnet. It uses existing Spore scripts; it introduces no NFT standard or custom on-chain contract. It is not audited or production-ready.

## Tested environment

Windows / PowerShell; Node **22.16.0**; pnpm **12.4.1**; OffCKB **0.4.13**. Exact dependencies are pinned in `package.json` and `pnpm-lock.yaml`: React 19.1.0, TypeScript 5.8.3, Vite 6.3.6, plugin-react 4.5.2, CCC core 1.23.0, CCC Spore 1.6.15, tsx 4.23.15. Vite 6 was selected to support the existing Node version. No system upgrades are needed.

The nested `pnpm-workspace.yaml` intentionally isolates Week07 from the parent workspace and previous-week lockfiles.

## Start on Windows

```powershell
Set-Location G:\neon\Week07\nft-minter
# If these commands are already on PATH, plain pnpm / offckb work too.
$pnpmCmd = Join-Path $env:APPDATA 'npm\pnpm.cmd'
$offckbCmd = Join-Path $env:APPDATA 'npm\offckb.cmd'
& $pnpmCmd install --frozen-lockfile
# Only when your local Devnet is not already running:
& $offckbCmd node --daemon
& $pnpmCmd configure
& $pnpmCmd diagnose
& $pnpmCmd dev
```

Open the **actual URL printed by Vite**. The verified session used `http://127.0.0.1:5173/`; Vite may choose a different port if occupied. The server binds to loopback. Keep Devnet and Vite running while using the app.

`configure` locates the globally installed `@offckb/cli` under `%APPDATA%\npm\node_modules`. If installed elsewhere, set `$env:OFFCKB_ROOT` to that package directory before running it. The script probes local RPC ports 28114 and 8114, requires a Devnet chain name, records the actual genesis block hash, exports live OffCKB script deployments, checks dependency cells and reads only OffCKB's two built-in disposable development accounts. Keys are written to ignored `.env.local` and never printed. `.env.example` documents the fields without keys.

**Every `VITE_*` variable, including demo private keys, is public in the browser bundle.** These are publicly known, disposable OffCKB accounts, not secure key storage. Never substitute real private keys or use real assets. Do not publish this bundle or expose its server publicly. No browser wallet, login, backend, IPFS service or database is needed.

The browser calls a same-origin `/rpc` Vite proxy, avoiding direct-browser CORS dependence. Both development and local production preview proxy to the discovered local RPC. Static hosting without that proxy is not supported. The client uses a CCC testnet address encoder (`ckt`); actual signing is gated by explicit `devnet`, loopback RPC, exact live chain name, pinned genesis and live dependency checks, not by address prefix alone.

## Demo walkthrough

1. Select **Account A**. Wait for **Node ready** and inspect its address and capacities.
2. Choose **Text**, enter words, then check the exact preview. Text is UTF-8, maximum 2048 bytes, with whitespace-only input rejected.
3. Or choose **Image** and select a PNG/JPEG under 20480 raw bytes. MIME, signature and browser decodability must agree. Original binary bytes go on-chain; no base64 string or blob URL is stored. These size limits are product limits, not protocol limits.
4. Click **Review creation**. Review account, owner, content, occupied capacity, prepared transaction fee, total and change. Click **Confirm & sign** only after checking them. Wait for **Committed**. The app checks owner and exact bytes against chain data.
5. Select the new item in **My Collection**. Open **On-chain details** for ID, owner and current live OutPoint.
6. Choose **Use account B**, review the transfer and confirm. Transfer spends the existing cell, preserves its Spore ID/data and creates a new owner cell. After commitment both demo collections are queried.
7. Switch to **Account B** and locate the same ID. Reload the page and select B again (account selection defaults to A). The collection is reconstructed from live chain cells.

Custom valid `ckt` recipients are also supported. Local addresses share a prefix with Testnet: verify that the intended recipient controls that lock on this Devnet. There is no public explorer link for local transaction hashes.

While preparing, reviewing or confirming a transaction, account switching and duplicate submission are disabled. A confirmation timeout or lost submission response is **unknown/pending**, not an automatic failure. The deterministic hash is preserved for **Recheck confirmation**, including page reloads; no automatic resubmission occurs. The latest status is local history only, not the ownership database. Historical status from a different genesis is not treated as an active transaction. Explicit rejection, insufficient capacity, invalid address, non-owner and stale input errors are handled separately.

## Architecture and chain concepts

| Path | Responsibility |
| --- | --- |
| `src/lib/config.ts`, `client.ts` | Local network guard, CCC client, demo signers, live-cell capacities |
| `src/lib/spore.ts` | SDK mint/transfer, paginated async collection iterator, chain readback |
| `src/lib/transactions.ts` | Submitted hash and confirmation states; pending versus rejection |
| `src/lib/validation.ts`, `amounts.ts` | Exact UTF-8, PNG/JPEG validation, bigint CKB formatting |
| `src/App.tsx`, `style.css` | Responsive account/create/collection/detail/review UI |
| `scripts/configure.mjs` | Discover deployments, local identity and public demo accounts |
| `scripts/diagnose.ts`, `smoke.ts`, `check-chain.ts` | Read-only diagnostics, opt-in real chain transactions, readback/guard checks |

A CKB cell has a **lock** that controls spending, a **type** that enforces Spore behavior and **data** containing its Molecule-encoded content type, bytes and optional Cluster ID. This MVP omits Cluster ID. The Spore SDK creates/decodes that format. Content is immutable; ownership changes through the output lock in a transfer.

CCC calculates minimum output capacity from the actual cell structure/data; `createSpore` sets that capacity. Transactions are completed with real inputs, a 1000 shannons/kB fee rate and a change output before review. The displayed fee is the actual input/output difference of that prepared transaction, checked again after signing. Capacity is stored in the NFT; a network fee is spent. Amounts use bigint shannons (100,000,000 = 1 CKB), never floating point.

Total live capacity is not the spendable balance. The UI separately reports capacity occupied by all live cell storage and capacity of plain untyped/empty-data cells available to this demo. A change cell must still retain its minimum occupied capacity. Typed NFT cells are excluded from mint funding.

Collection data is queried using the verified Spore deployment and signer lock(s), iterating SDK pagination. LocalStorage is used only for the latest transaction status. Text renders as escaped text; only validated PNG/JPEG is previewed. HTML/SVG and unsupported content never execute. Temporary object URLs are revoked. The displayed OutPoint identifies the current ownership transaction; it is not labeled a creation transaction unless known.

## Verification commands

```powershell
Set-Location G:\neon\Week07\nft-minter
$pnpmCmd = Join-Path $env:APPDATA 'npm\pnpm.cmd'
& $pnpmCmd test
& $pnpmCmd build
& $pnpmCmd diagnose
# Opt-in: mints two new NFTs and transfers the text NFT from A to B.
& $pnpmCmd smoke
# Read-only assertions against the recorded smoke evidence and current chain:
& $pnpmCmd check:chain
# Serve the built app locally with the same RPC proxy:
& $pnpmCmd preview
```

Executed on 2026-10-28:

- **8/8 unit tests passed**: Unicode byte boundaries, empty/spoofed/oversized images, pre-read file limit, exact large integer formatting, pending/rejection states, polling outages, errors and configuration guard.
- **Production build passed** (TypeScript and Vite). Vite reports a non-blocking large JavaScript chunk warning (~726 kB uncompressed) from the combined app/SDK bundle.
- **Real chain smoke passed**: text and PNG committed; queried byte-for-byte; A-to-B transfer committed with the same ID and identical serialized data; A absent/B present.
- **Readback/guard checks passed**: reconstruct both collections from chain; reject non-owner transfer; reject demo signer on mismatched genesis.
- Browser accessibility confirmed **Node ready**, the real A address/balances, text/PNG collection and a 32-byte text input with matching preview. `/rpc` returned `ckb_dev` through Vite.
- **Not verified through UI yet:** clicking review/confirm to commit a browser-originated mint/transfer, invalid-image decodability in a complete upload flow, responsive screenshots and visual layout. Browser automation's tab host was unavailable; native click returned `coordinate input geometry is unavailable`, and screenshot capture returned VS Code instead of Chrome. Do not count this as complete UI acceptance or 100% completion.

Detailed hashes and results: [text smoke](evidence/text-smoke.json), [full chain smoke](evidence/chain-smoke.json), [subsequent chain readback](evidence/chain-readback.json). [Evidence checklist](docs/EVIDENCE.md) lists exact remaining captures. [Report notes](docs/WEEK07_REPORT_NOTES.md) distinguish implementation, verified results and remaining manual checks.

## Restart and reset

Normal restart: start OffCKB if needed and `pnpm dev`; existing Spores are rediscovered from live chain cells. Configuration changes require restarting Vite. Do not reset a Devnet that contains earlier-week deployments.

After an intentional reset, old dependency cells or chain identity may be stale. Run `pnpm configure`, then `pnpm diagnose`, and restart Vite. Preserve old evidence as historical; it does not prove current ownership on a new chain. `check:chain` deliberately rejects a genesis mismatch. A reset restoring exactly the same genesis cannot be distinguished by the genesis hash alone; live dependencies and current collections are checked again. No automatic chain reset, destructive cleanup or historical evidence deletion is performed.

## Limitations and future work

Local demo accounts only; no Mainnet/Testnet signer mode, production deployment, browser-wallet integration, marketplace, royalties, batches, Clusters, DOB decoders, mutable metadata or melt/burn. Future Testnet integration requires a real wallet connector and distinct deployments, not enabling these demo keys remotely. The current build could be split further to reduce initial JavaScript size. UI acceptance and screenshot evidence remain to be completed as documented above.

## References and attribution

Original Week07 application code written for this workspace. No previous-week files or custom contracts were copied/modified. Spore codecs and operations are supplied by MIT-licensed CCC/Spore packages. The tiny generated PNG in `evidence/smoke-source.png` is the actual smoke-test byte fixture, not a screenshot. Google Fonts supplies optional DM Sans/Manrope; system sans-serif is the offline fallback.

- [Nervos Create a Digital Object](https://docs.nervos.org/docs/dapp/create-dob)
- [CCC documentation](https://docs.nervos.org/docs/sdk-and-devtool/ccc)
- [CCC source](https://github.com/ckb-devrel/ccc)
- [OffCKB source](https://github.com/ckb-devrel/offckb)
- [Spore Protocol 101](https://docs.spore.pro/basics/spore-101)
- [Spore technical design](https://docs.spore.pro/basics/technical-design/)
- [Spore operations](https://docs.spore.pro/basics/spore-operation)
- [CCC Molecule](https://docs.nervos.org/docs/serialization/ccc-molecule)
