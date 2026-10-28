# CKB NFT Minter — Week07

React/TypeScript application for creating and transferring Spore NFTs on **CKB Testnet**. The app connects to a wallet through CCC, stores NFT content on-chain, reads the connected wallet's collection and links transactions to the Testnet explorer.

See the [Week07 report](../Week07.md) for implementation results and the screenshot evidence index.

## Run locally

Use Node.js **22.16.x** and pnpm **12.4.1**. Dependencies are pinned in `package.json` and `pnpm-lock.yaml`.

```powershell
Set-Location G:\neon\Week07\nft-minter
pnpm install --frozen-lockfile
pnpm configure:testnet
pnpm dev
```

If pnpm is installed under the Windows user profile but is missing from PATH:

```powershell
$pnpmCmd = Join-Path $env:APPDATA 'npm\pnpm.cmd'
& $pnpmCmd install --frozen-lockfile
& $pnpmCmd configure:testnet
& $pnpmCmd dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`. Restart Vite after changing network configuration. Testnet mode does not require OffCKB.

`configure:testnet` writes the following settings to the ignored `.env.local`:

```dotenv
VITE_CHAIN=testnet
VITE_TESTNET_RPC_URL=https://testnet.ckb.dev/
```

The browser uses a same-origin `/rpc` proxy. Vite development and preview servers provide this proxy; a standalone static deployment needs an equivalent RPC proxy.

## Wallet, mint and transfer

1. Wait for **Testnet ready**, click **Connect Wallet** and connect a Testnet account. The supplied screenshots use JoyID Passkey.
2. Copy the address shown in the app, use **Get free Testnet CKB**, then click **Refresh** after funding. The app separates total capacity, spendable plain cells and occupied storage.
3. Enter text or choose a PNG/JPEG. Text is limited to **2048 UTF-8 bytes**; images are limited to **20 KiB** of original bytes. These are application limits.
4. Click **Review creation**. Check the content, owner, cell capacity, fee and change; then click **Confirm in wallet** and approve in the wallet.
5. Wait for **Committed**. Inspect the NFT in **My Collection** and open **View on Testnet Explorer**.
6. Select **View / Transfer**, enter the recipient's Testnet address, review the transaction and approve it in the wallet. A successful transfer preserves the Spore ID and content while changing the owner lock.
7. If confirmation remains pending, use **Recheck confirmation**. A timeout does not trigger automatic resubmission.

No seed phrase or private key is entered in the Testnet UI. NFT content becomes immutable after creation; CKB capacity remains allocated to the NFT cell, while the transaction fee is spent.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Selects Testnet by default or the optional local Devnet mode |
| `src/TestnetApp.tsx`, `src/testnet.css` | Wallet connection, balances, create/transfer reviews, collection and transaction status |
| `src/lib/testnet.ts` | Testnet identity/deployment checks, wallet session and explorer links |
| `src/lib/spore.ts` | Spore creation, transfer, live collection queries and owner/content verification |
| `src/lib/transactions.ts` | Submission and confirmation states, including pending/recheck handling |
| `src/lib/validation.ts`, `src/lib/amounts.ts` | Content validation and exact bigint CKB formatting |
| `src/components.tsx`, `src/style.css` | Shared previews, copy controls and styles |
| `src/lib/*.test.ts` | Unit and regression tests |
| `scripts/` | Testnet configuration/diagnostics and retained local Devnet utilities |
| `evidence/` | Original screenshots and the small Devnet image fixture |

The Testnet session checks both `ckb_testnet` and genesis hash `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`, then checks the SDK's live Spore dependency and code hash. It rejects built-in CKB private-key signers. The network guard unwraps CCC client proxies before comparing client identity, allowing the connector's fee-rate wrapper without treating it as a network change.

Spore **lock** scripts control ownership, **type** scripts enforce protocol rules, and **data** stores encoded content. Collection data comes from live chain cells. Local storage retains the latest transaction status; it does not determine NFT ownership. Before broadcasting, the app checks that the signed raw transaction, sender and fee still match the review.

## Verification

```powershell
pnpm test
pnpm build
```

Most recent local validation: **14 tests passed**, TypeScript passed and the production build succeeded. Vite reports a non-blocking warning about a large dependency chunk. Tests include content validation, bigint formatting, pending status, chain identity, CCC client wrappers and changes to the wallet account or reviewed transaction.

Optional read-only network diagnostic:

```powershell
pnpm diagnose:testnet
```

This command checks public RPC identity and the Spore deployment, then writes `evidence/testnet-diagnostics.json`. That output is generated locally and is not currently included in the evidence folder. It is a protocol diagnostic, not proof of a user mint or transfer.

## Retained local Devnet mode

The original local implementation remains in `src/DevnetApp.tsx` and `src/lib/client.ts`. To use it, install OffCKB, start its local node and configure the app:

```powershell
$offckbCmd = Join-Path $env:APPDATA 'npm\offckb.cmd'
& $offckbCmd node --daemon
pnpm configure
pnpm diagnose
pnpm dev
```

`configure` discovers local deployments and the built-in disposable OffCKB accounts. If OffCKB is installed outside the default user npm directory, set `OFFCKB_ROOT` to its package directory. Devnet configuration uses `.env.local`; every `VITE_*` value is visible in the browser bundle, so only disposable local demo keys belong there.

`pnpm smoke` submits local Devnet mint/transfer transactions and writes evidence JSON; `pnpm check:chain` performs local readback checks. These commands do not create public Testnet transactions. Run `pnpm configure:testnet` and restart Vite to return to Testnet.

## Scope

The app supports standalone text/image Spores, wallet signing and individual transfers. Mainnet, marketplace features, Clusters, batch operations, burn and an IPFS backend are outside this implementation. Screenshot evidence demonstrates Testnet minting and the transfer form; completed transfer and receiving-wallet evidence are not yet included.
