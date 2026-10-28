# CKBuilder Weekly Dev Log — Week07

**Project:** CKB NFT Minter

**Participant:** Trung Do

**Evidence date:** October 28, 2026

**Network:** CKB Testnet

## 1. Overview

This project implements a browser application for creating and transferring Spore NFTs on CKB Testnet. Users connect a wallet, fund its Testnet address, review NFT content and transaction costs, approve a signature, and inspect the resulting on-chain asset.

The supplied screenshots show a JoyID wallet connection, a successful text NFT creation message, an owned Spore, a wallet signing request and a transaction displayed on the explorer. The transfer form is implemented and captured, but the current evidence does not show a completed transfer or the receiving wallet's collection.

## 2. Environment

| Component | Version or configuration |
| --- | --- |
| Frontend | React 19.1.0, TypeScript 5.8.3, Vite 6.3.6 |
| Runtime | Node.js 22.16.x; project package manager pnpm 12.4.1 |
| CCC | `@ckb-ccc/core` 1.23.0, `@ckb-ccc/connector-react` 2.2.2 |
| Spore SDK | `@ckb-ccc/spore` 1.6.15 |
| Wallet shown in evidence | JoyID Passkey on Testnet |
| RPC configuration | `https://testnet.ckb.dev/`, accessed through the Vite `/rpc` proxy |
| Local app | `http://127.0.0.1:5173/` in the signing screenshot |
| Source | [nft-minter/](nft-minter/) |

## 3. Implemented features

- Connect and disconnect a wallet through CCC; display the account's Testnet address and capacity breakdown.
- Create text NFTs and PNG/JPEG NFTs with exact content previews and input validation.
- Prepare inputs, capacity, fees and change before presenting the signing review.
- Read the wallet's Spore collection from live cells and display content, owner, Spore ID and current OutPoint.
- Prepare a transfer to a Testnet recipient while preserving the existing Spore ID and content.
- Track submission/confirmation, retain the latest transaction hash and provide explorer and recheck controls.
- Verify owner/content after commitment and block stale inputs or changes to the reviewed transaction/account.

A Spore cell combines an owner lock, a protocol type script and encoded immutable content. Transferring it spends the current live cell and creates a cell controlled by the recipient, preserving the ID and data. The app creates standalone Spores without Clusters.

## 4. Evidence

The original files are preserved in [nft-minter/evidence/](nft-minter/evidence/). Descriptions below reflect what each screenshot actually shows.

| File | Observation |
| --- | --- |
| [01_UI.png](nft-minter/evidence/01_UI.png) | Application layout, public Testnet badge, connection controls and creation/collection panels |
| [02_Connect_Wallet.png](nft-minter/evidence/02_Connect_Wallet.png) | CCC chain-selection dialog for JoyID Passkey |
| [03_Connected.png](nft-minter/evidence/03_Connected.png) | Connected JoyID account, Testnet-ready status, address and capacity breakdown |
| [04_NFT_Creation.png](nft-minter/evidence/04_NFT_Creation.png) | Successful creation notice and an owned `text/plain` NFT containing `Trung`; the editor separately contains `Trung1` |
| [05_Signing_Transaction.png](nft-minter/evidence/05_Signing_Transaction.png) | JoyID Testnet signing request over a creation review for `Trung1`, showing one DOB and a 0.00002004 CKB network fee |
| [06_Explorer.png](nft-minter/evidence/06_Explorer.png) | Explorer transaction with three confirmations at capture time, one input and two outputs, including a unique item |
| [07_TransferNFT.png](nft-minter/evidence/07_TransferNFT.png) | Selected `Trung` NFT, ID, owner, live OutPoint and transfer form; recipient is empty and the review button is disabled |

The explorer screenshot records transaction hash:

```text
0x471610ffbd4ca414cfb9e9fc8eaff20e7eeba50115d7577768a1131b0f94af67
```

The report transcribes this value from the supplied image; the transaction has not been independently queried again during this documentation cleanup. The screenshots depict different content states, so this report does not assume that every capture belongs to the same mint.

`smoke-source.png` is a 68-byte image fixture retained from the local Devnet smoke script. It is not a screenshot or evidence of a Testnet image mint. Historical JSON diagnostics/readback files are absent from the current evidence folder and are not used to substantiate this report.

## 5. Verification and wallet network fix

The most recent local checks completed with **14 tests passed**, a successful TypeScript check and a successful production build. The build has a non-blocking warning about a large dependency chunk.

Tests cover UTF-8 byte limits, image input checks, exact CKB amounts, pending/failed status handling, Testnet chain identity, signer restrictions and changes to the account or reviewed transaction before broadcast.

The message `Wallet network changed. Reconnect using CKB Testnet.` was traced to comparing client objects directly. CCC wraps the selected client to support fee-rate selection. The network guard now unwraps CCC proxies and compares their underlying clients. Regression coverage permits wrappers around the configured client while continuing to reject a different client or Mainnet client and CKB private-key signers.

## 6. Current result and remaining evidence

| Item | Status |
| --- | --- |
| Testnet wallet connection | Shown in screenshots |
| Text NFT creation and owned collection | Shown in screenshots |
| Wallet approval request | Shown in screenshot |
| Transaction explorer | Confirmed transaction shown at capture time |
| Image NFT creation | Implemented; no Testnet image-mint screenshot included |
| Transfer | Implemented; transfer form shown, completed transfer not evidenced |
| Recipient ownership after transfer | No receiving-wallet screenshot included |
| Unit tests, TypeScript and build | Passed locally |
| Mobile layout and keyboard acceptance | No dedicated evidence included |

To complete transfer evidence, submit a reviewed transfer, capture its committed transaction and reconnect the receiving account to show the same Spore ID and content under the new owner. This report does not claim completion of that acceptance step.

## 7. Reproduction and retained files

The [application README](nft-minter/README.md) provides setup, Testnet usage, checks and concise instructions for the optional local Devnet implementation. Source code, scripts, configuration, dependency lockfiles and all existing evidence are retained. The old Devnet README and duplicated handoff/checklist documents were consolidated into these two Markdown files; generated build output can be recreated with `pnpm build`.
