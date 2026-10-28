# CKB NFT Minter — Week07 / CKB Testnet

Owner: **Trung Do**. React/TypeScript Spore NFT minter for the public **CKB Testnet (Pudge)**. Connect a wallet, create text/PNG/JPEG NFTs, inspect on-chain ownership and transfer the same Spore to another Testnet address. New transactions link directly to the Testnet explorer.

The user requested the switch from local Devnet to public Testnet. The previous Devnet implementation and evidence are preserved separately. Existing Devnet assets/hashes are not migrated or visible on public Testnet.

## Start on Windows

Tested: Node 22.16.0, pnpm 12.4.1, Vite 6.3.6, React 19.1.0, TypeScript 5.8.3, CCC core 1.23.0, Spore 1.6.15 and connector-react 2.2.2. Exact dependencies and the isolated lockfile live in this directory. No changes to previous weeks are required.

```powershell
Set-Location G:\neon\Week07\nft-minter
$pnpmCmd = Join-Path $env:APPDATA 'npm\pnpm.cmd'
& $pnpmCmd install --frozen-lockfile
& $pnpmCmd configure:testnet
& $pnpmCmd dev
```

Open the URL Vite prints, currently **http://127.0.0.1:5173/**. Restart Vite after changing configuration. OffCKB is not required in Testnet mode. The server binds to loopback; `/rpc` proxies to an official HTTPS Testnet endpoint, avoiding browser CORS issues. Local `pnpm preview` uses the same proxy. Static deployment without a proxy is not configured.

`configure:testnet` writes only `VITE_CHAIN=testnet` and `VITE_TESTNET_RPC_URL=https://testnet.ckb.dev/` into ignored `.env.local`. If the previous local config was Devnet, it is preserved in ignored `.env.devnet.local` without printing keys. Never put a real private key or seed phrase in any `VITE_*` variable.

## Connect, fund, create and transfer

1. Reload the app and check the **CKB Testnet — Public network** badge and **Testnet ready** status.
2. Click **Connect Wallet** and choose an available wallet in the CCC picker. For example, JoyID is supported by CCC. Complete any login/account creation directly in the wallet. Use a wallet/account intended for Testnet. The app never asks for your private key or seed phrase.
3. Copy the address displayed by the app. Open **Get free Testnet CKB**, request tokens for that address at [the Nervos faucet](https://faucet.nervos.org/), wait for funding and click **Refresh**. Total, plain-cell spendable capacity and occupied storage are separate. These are Testnet tokens, not Mainnet funds.
4. Enter text (up to 2048 UTF-8 bytes) or upload a PNG/JPEG (up to 20480 original binary bytes). Inspect the exact preview. Text must be non-empty; images must match their MIME/signature and decode in the browser. These are product limits, not Spore protocol limits.
5. Click **Review creation**, check content, sender/owner, capacity, finalized fee and change. Click **Confirm in wallet** and approve the signature in your own wallet. Content is immutable after minting. Wait for **Committed**, then use **View on Testnet Explorer**.
6. In **My Collection**, click the explicit **View / Transfer** button. Enter another person's Testnet `ckt1...` address, click **Review transfer**, check the recipient and fee, and confirm in your wallet. The ID/data are preserved; ownership changes through a new live cell.
7. Open the transaction link or current ownership transaction from the NFT details. A new transaction may take time to appear on the explorer. A pending timeout is not treated as a rejection or automatically resubmitted; use **Recheck confirmation**.

There are no Testnet demo accounts A/B. To demonstrate receiving, use another Testnet wallet/account you control. Reconnect that wallet and refresh to query its own collection from chain. Devnet and Testnet latest transaction histories use distinct storage keys and genesis identities; localStorage is never an ownership database.

## Architecture

- `src/App.tsx` selects the configured network. Testnet is the default. `TestnetApp.tsx` supplies a Testnet-only CCC wallet picker, capacity display, mint/transfer reviews and explorer links. `DevnetApp.tsx` preserves the optional original local demo.
- `src/lib/testnet.ts` provides the wallet-backed session, validated explorer links and strict public Testnet identity/deployment checks. No private-key signer is instantiated for Testnet; a Devnet private-key signer is explicitly refused. The wallet's client must match the configured client.
- `src/lib/client.ts` retains the guarded local Devnet session. `spore.ts` shares Spore SDK create/transfer operations and paginated live-cell collection queries across networks.
- The SDK supplies the Testnet Spore deployment. Live dependency data is checked against its code hash. Identity must match both `ckb_testnet` and the independently checked Testnet genesis; an address prefix alone is insufficient.
- CCC calculates output capacity from actual cell structure/data and completes real inputs/fees/change before review. Integer bigint shannons are used for every amount. After signing, the reviewed raw transaction hash, sender and fee are checked again before broadcasting.
- A Spore cell's **lock** controls its owner, **type** enforces Spore rules and **data** contains Molecule-encoded content type/content/optional Cluster ID. This app creates standalone Spores without Clusters. Transfer spends the live cell and changes its lock while preserving immutable data and ID. No custom contract or JSON metadata wrapper is introduced.
- Text is escaped; HTML/SVG is not executed. PNG/JPEG previews validate chain data and revoke object URLs. NFT details distinguish the current ownership OutPoint from the original creation transaction.

## Checks and honest validation status

```powershell
$pnpmCmd = Join-Path $env:APPDATA 'npm\pnpm.cmd'
& $pnpmCmd test
& $pnpmCmd build
& $pnpmCmd diagnose:testnet
```

Verified on 2026-10-28:

- **13/13 tests passed**, including final transaction-review hardening. Tests cover content validation, bigint formatting, pending versus rejected, public chain identity, external-wallet requirements, explorer URLs and blocking broadcast when a wallet changes account or modifies the reviewed raw transaction.
- TypeScript and production build passed with connector-react. A non-blocking large CCC chunk warning remains.
- Both official public Testnet RPCs returned the same genesis, `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`.
- The SDK's Testnet Spore dependency is live, its code hash matches the live bytes, and the deployment transaction is committed. See [testnet diagnostics](evidence/testnet-diagnostics.json). This is **the protocol deployment transaction, not a newly minted user NFT**.
- The running Vite `/rpc` now returns `ckb_testnet`.
- **No user Testnet mint/transfer has yet been signed or submitted by this agent.** Wallet connection, faucet funding and signature approval require the user's wallet interaction. Old successful mint/transfer records are explicitly Devnet evidence.

The next acceptance check is a funded wallet mint followed by a transfer, with actual newly observed hashes checked on the public explorer. [Evidence checklist](docs/EVIDENCE.md) and [report notes](docs/WEEK07_REPORT_NOTES.md) separate historical Devnet results from current Testnet validation. No screenshot or successful user transaction is fabricated.

## Optional historical local Devnet mode

See [README.devnet.md](README.devnet.md). Running `pnpm configure` explicitly returns to the local OffCKB setup and public disposable demo accounts; restart Vite afterward. `pnpm diagnose`, `pnpm smoke`, and `pnpm check:chain` are **Devnet commands**, not Testnet mint scripts. `smoke` creates real local test NFTs; do not run it expecting public explorer hashes.

## Limitations and references

Educational work, not audited or production-ready. No Mainnet mode, marketplace, Clusters/DOB decoders, batches, burn, IPFS backend or database. Initial public Testnet wallet flows await user signing. Browser automation was unreliable in this environment, so visual screenshot evidence is still manual. The wallet connector introduces additional bundle size; further splitting is possible.

Original Week07 source; CCC/Spore codecs and wallet integration use MIT-licensed upstream packages. No previous weeks were modified. Optional Google Fonts have a system-font fallback.

- [Official CKB networks, RPC, explorer and faucet](https://docs.nervos.org/docs/getting-started/ckb-networks)
- [CCC wallet connection](https://docs.ckbccc.com/en/docs/guides/connect-wallets)
- [CCC connector-react](https://docs.ckbccc.com/en/docs/packages/core-packages/connector-react)
- [Nervos Spore tutorial](https://docs.nervos.org/docs/dapp/create-dob)
- [CCC source](https://github.com/ckb-devrel/ccc)
- [Spore technical design](https://docs.spore.pro/basics/technical-design/)
