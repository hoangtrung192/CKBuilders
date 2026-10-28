# Week07 evidence checklist

## Current Testnet follow-up (user-requested network change)

The application now runs on public CKB Testnet with a connected wallet. `../evidence/testnet-diagnostics.json` records verified chain identity, independently checked genesis, live SDK Spore code and committed protocol deployment. It does **not** record a user NFT mint.

Capture these additional Testnet screenshots after connecting/funding your wallet:

1. Testnet badge, Testnet ready, connected wallet address and capacity breakdown.
2. Text/image review showing exact content, owner, capacity, fee and change.
3. Wallet-approved mint Committed, its **new actual Testnet hash** and **View on Testnet Explorer**; capture that transaction on the explorer too.
4. NFT detail and Transfer review with recipient Testnet address.
5. Transfer Committed and matching explorer transaction; reconnect the receiving wallet and confirm the same Spore ID/content.
6. Current tests/build output and narrow-layout screenshot.

Never submit a historical Devnet hash as Testnet evidence. The sections below preserve the original local Devnet evidence/history and manual checklist. Testnet does not use demo accounts A/B.

All recorded chain hashes are observations from 2026-10-28 on genesis `0xb15fa8a50781f3a8bf84759682e2ce4027b7ae5361df45e8b68855ee413104be`. Recheck the current chain before treating historical evidence as live.

## Existing evidence

- [x] `../evidence/text-smoke.json`: first text mint committed, 47 identical UTF-8 bytes read back.
- [x] `../evidence/chain-smoke.json`: text and PNG mint, followed by A-to-B transfer with exact ID/data preservation.
- [x] `../evidence/smoke-source.png`: 68 original raw PNG bytes used in the integration test (not a screenshot).
- [x] `../evidence/chain-readback.json`: later fresh collection query, non-owner rejection and wrong-genesis signer guard.
- [x] Unit tests 8/8 and production build passed in the terminal.
- [x] Chrome accessibility observation: Node ready, address/balances, 2 owned assets (text and PNG); typed 32-byte UI text matched its preview.

## Manual UI acceptance and captures still required

No placeholder screenshots have been created. Browser tab automation returned `The browser access host is unavailable`. Native click returned `coordinate input geometry is unavailable`; screenshot capture showed VS Code instead of the bound Chrome window. Accessibility read and input worked, but review/sign clicks and trustworthy screenshots could not be completed.

Start the app using the README, open the printed URL, and save screenshots under `evidence/`:

1. `01_environment.png`: terminal showing `node --version`, `pnpm --version`, `offckb --version` and Vite's actual URL. If not on PATH, use the explicit `.cmd` paths in README.
2. `02_account_a.png` and `03_account_b.png`: each account's active address, Node ready and all capacity labels. Do not display `.env.local` or private keys.
3. `04_text_smoke.png`: terminal `Get-Content evidence/text-smoke.json`, displaying its actual hash/Spore ID.
4. `05_text_review.png`: on A, enter a distinctive text; click Review creation. Capture exact content, owner/account, capacity, fee and change before signing.
5. `06_image_review.png`: cancel the review, select Image, upload a PNG/JPEG under 20 KiB (the smoke-source PNG works but is a tiny white pixel). Capture preview, raw byte size and cost review. Also try a text file renamed `.png`, an empty file, an oversized image and an invalid image with a matching header; each must be rejected.
6. `07_ui_mint_committed.png`: confirm one new NFT in the UI. Wait for Committed and the verified-content notice. Record the full actual hash and ID in a separate `ui-demo.json` or report notes.
7. `08_a_before_transfer.png`: select that owned NFT; expand On-chain details. Capture ID/current owner/current OutPoint.
8. `09_transfer_review.png`: use account B recipient; review from/to and fee; capture before confirming.
9. `10_transfer_committed.png`: after confirmation, capture Committed and the full transfer hash. A's collection must no longer show that ID.
10. `11_b_after_transfer.png`: switch to B, select the same ID and verify identical text/image, owner B and new OutPoint. Reload and select B again; capture the reconstructed collection.
11. `12_tests_build.png`: run `pnpm test` and `pnpm build`; capture successful results. Do not crop away real failures or label the size warning as a failed build.
12. `13_mobile.png`: use a narrow browser window to check readability, review scrolling and account selector. Confirm no horizontal overflow and no hidden confirm/cancel actions.

Also manually check keyboard navigation, copy buttons, modal cancellation, duplicate-click blocking, invalid `ckt` recipients, and pending/recheck behavior. Do not reset the shared Devnet to test an error path. Unit tests already simulate a polling outage without submitting duplicate transactions.

## Current real transfer reference

Spore ID: `0xba64e1aab178c428bdfc6552b7b65c13e15ae745d5bca7e6340ca5a8adca8b03`

Mint hash: `0x2fe27b6077cf24ad3dd095a377d0b37508ae569f66e1cb3f891ddbbadcc07572`

Transfer hash: `0x731fd993861cd5b1c89847942c0f2f066b6208142b706d20b248926b4288ff32`

These transactions were submitted by the integration script, not the UI. Keep that distinction in the report. Do not attach a public Testnet explorer link to local hashes.
