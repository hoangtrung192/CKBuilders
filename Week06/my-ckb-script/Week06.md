# Week06 Report — Secret Vault on Nervos CKB

**Owner:** Daniel Do  
**Project:** Secret Vault — CKB Builder Week06  
**Network:** Local Devnet (`http://127.0.0.1:8114`)

## 1. Objectives

In Week06, I built a Secret Vault application on Nervos CKB. The application locks CKB in a cell using a secret hash and a designated recipient's lock hash. Unlocking requires the correct secret and a transaction that returns the vault capacity to the intended recipient under the contract's rules.

The exercise helped me understand cells, lock scripts, witnesses, cell dependencies, and capacity accounting. After implementing the contract, I added CLI scripts and a React interface to complete the creation and unlocking workflow.

All demonstration transactions were performed on **local Devnet**, not public Testnet.

## 2. Technologies and Environment

| Component              | Technology / declared version                         |
| ---------------------- | ----------------------------------------------------- |
| Contract               | TypeScript and CKB-JS-VM                              |
| CLI                    | `@ckb-ccc/core` version `1.11.0`, executed with `tsx` |
| Frontend               | React and React DOM `^19.3.1`, TypeScript `~6.0.3`    |
| CCC React integration  | `@ckb-ccc/connector-react` version `^2.2.2`           |
| Frontend tooling       | Vite `^8.3.4`                                         |
| Blockchain environment | Local CKB Devnet                                      |
| Dependency management  | pnpm workspace                                        |

These versions are declarations recorded during the exercise. The `^` and `~` prefixes allow compatible version ranges; exact installed versions should be checked against `pnpm-lock.yaml`.

The CLI uses `ClientPublicTestnet` with an explicitly configured local RPC endpoint and Devnet system-script mappings. The class name does not mean the application connects to public Testnet.

The browser sends RPC requests to `/ckb`. Vite proxies these requests to `http://127.0.0.1:8114`.

## 3. Secret Vault Design

### 3.1. Main Components

- **Contract:** validates the conditions for spending a vault cell.
- **CKB-JS-VM:** executes the TypeScript contract bytecode.
- **CCC:** handles transaction construction, input selection, fee completion, signing, and submission.
- **CLI:** creates and unlocks vaults and saves transaction metadata to JSON files.
- **React interface:** connects a demo signer, displays account data, and provides creation and unlocking forms.

The vault is protected by a **lock script**. Its outer script references the deployed CKB-JS-VM binary. Its arguments identify the vault bytecode and contain the secret and recipient hashes. An unlock transaction includes both the VM and vault-bytecode deployments as cell dependencies.

### 3.2. Lock Arguments

The lock arguments contain **99 bytes**. Offsets are zero-based and inclusive; the textual `0x` prefix does not count as a byte.

| Offset | Length   | Field                                                |
| ------ | -------- | ---------------------------------------------------- |
| 0–1    | 2 bytes  | Prefix `0x0000`                                      |
| 2–33   | 32 bytes | Code hash of the deployed vault bytecode, `index.bc` |
| 34     | 1 byte   | Vault bytecode hash type                             |
| 35–66  | 32 bytes | Secret hash                                          |
| 67–98  | 32 bytes | Recipient lock-script hash                           |

The secret is encoded as UTF-8 before calculating its CKB hash. The recipient hash is calculated from the complete recipient lock script, rather than from the address string.

The vault cell data does not contain the original secret. During unlocking, the secret is supplied in the `lock` field of `WitnessArgs` in the first witness of the vault input group.

### 3.3. Unlock Conditions

The original project report describes the following contract checks:

| Condition                                                                                    | Error code on failure |
| -------------------------------------------------------------------------------------------- | --------------------- |
| Arguments are exactly 99 bytes, and the recipient lock hash differs from the vault lock hash | `10`                  |
| The witness can be decoded and contains a nonempty secret                                    | `11`                  |
| The secret hash matches the stored hash                                                      | `12`                  |
| Output 0 exists and uses the recipient lock                                                  | `13`                  |
| Input 0 is the vault, and all additional inputs use the recipient lock                       | `14`                  |
| Output 0 receives at least the capacity of the vault input                                   | `15`                  |

The contract source and test files were not attached to the Markdown supplied for this revision. This table retains the technical description from the original project report; error codes should be checked against the source whenever the contract changes.

The contract does not require the literal secret `week06-secret` or exactly 300 CKB. Those values are used in the demonstration. Checks for a plain CKB cell, matching metadata, matching deployment, and a connected recipient signer are additional client-side validation.

### 3.4. Full Repayment and Separate Fees

The unlock transaction places the vault at input 0 and returns its full capacity in output 0. Additional recipient-owned inputs provide capacity for fees and change.

For the demonstration:

```text
Vault capacity:       300 CKB = 30,000,000,000 shannons
Recipient output:     300 CKB
Transaction fee:      paid from separate input capacity
```

`completeInputsByCapacity(signer, 100n * 100_000_000n)` requests additional input capacity when completing the transaction. The 100 CKB value is **not a fixed transaction fee**. Fees are completed separately through `completeFeeBy`; the unlock script's `100_000` argument is a fee rate, not a CKB amount.

## 4. Project Structure

| Path                                               | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| `packages/on-chain-script/src/index.ts`            | Vault contract source                         |
| `packages/on-chain-script/dist/index.bc`           | Compiled contract bytecode                    |
| `packages/on-chain-script-tests/src/index.test.ts` | Contract tests                                |
| `scripts/create-vault.ts`                          | CLI vault creation                            |
| `scripts/unlock-vault.ts`                          | CLI vault unlocking                           |
| `scripts/devnet-client.ts`                         | Devnet client and system-script configuration |
| `scripts/fund-demo.ts`                             | Funds the demo account with local CKB         |
| `deployment/scripts.json`                          | Vault deployment metadata                     |
| `deployment-js-vm/scripts.json`                    | CKB-JS-VM deployment metadata                 |
| `packages/vault-ui/src/App.tsx`                    | Dashboard and demo signer                     |
| `packages/vault-ui/src/CreateVault.tsx`            | Vault creation form                           |
| `packages/vault-ui/src/UnlockVault.tsx`            | Vault unlocking form                          |
| `packages/vault-ui/src/devnet.ts`                  | Browser client configuration                  |
| `packages/vault-ui/public/deployment-devnet.json`  | Public deployment metadata used by the UI     |
| `packages/vault-ui/vite.config.ts`                 | Frontend port and RPC proxy                   |
| `vault.json`, `unlock.json`                        | CLI transaction records                       |

`a.key` contains the local CLI account's private key. Its contents must not be included in the README or a public submission package.

## 5. Implementation Process

### 5.1. Contract and Deployment

I implemented the contract, compiled it to bytecode, and deployed the contract and CKB-JS-VM to Devnet. Deployment metadata is stored in JSON files for the CLI and frontend to reference.

Deployment outpoints belong to a particular Devnet state. After resetting Devnet, the deployment configuration must be checked and updated before reusing the scripts.

### 5.2. Creating a Vault Through the CLI

The creation script loads the local signer, constructs the 99-byte arguments, and creates a 300 CKB vault output. CCC selects inputs, completes fees, signs, and submits the transaction. The script saves metadata to `vault.json` and waits for confirmation.

I then queried the outpoint using `get_live_cell`. A `live` response confirmed that the vault existed and remained unspent at the time of the query.

### 5.3. Unlocking Through the CLI

The unlock script checks the live cell, lock, secret, and recipient. It places the secret in the witness, adds the required dependencies, and creates an output returning the full 300 CKB. A separate recipient-owned input covers fees.

The observed result included `Vault unlock confirmed.`, two inputs, and repayment of 300 CKB. After confirmation, the original vault outpoint was no longer live. An `unknown` live-cell result is interpreted together with the confirmed unlock transaction; it is not sufficient evidence of success by itself.

### 5.4. Frontend and Demo Signer

I built the frontend with React, TypeScript, and Vite. The dashboard displays the address, Devnet balance, and current block.

For this exercise, I used `SignerCkbPrivateKey` with a public sample key instead of an extension wallet. The demo signer is intended only for local Devnet. `fund-demo.ts` sends 1,000 CKB from the local account when the demo account balance is below that threshold.

### 5.5. Creating and Unlocking Through the UI

The creation form accepts a CKB amount, a recipient address, and a secret. An empty recipient field selects the connected demo account. After submission, the UI displays the transaction hash, stores creation metadata in localStorage, and offers a `vault-ui.json` download.

The unlock form reads saved metadata or accepts pasted JSON. Before building the transaction, it checks the live cell, deployment, secret, and connected recipient.

The observed UI confirmation was:

```text
Vault unlock confirmed. Đã trả 300 CKB.
```

The Vietnamese message means that unlocking was confirmed and 300 CKB was returned. The UI also displays the unlock transaction hash.

## 6. Running the Project

### 6.1. Prerequisites

The environment requires Node.js, pnpm, project dependencies, and the existing local Devnet setup. Contract compilation and execution tests require the relevant CKB-JS-VM tools, including `ckb-debugger`.

Open PowerShell in the project root:

```powershell
Set-Location 'G:\neon\Week06\my-ckb-script'
pnpm install
```

Start Devnet and block production using the local setup used for deployment. The supplied report does not contain complete node/miner startup commands or the VM deployment command, so those commands are not guessed here.

Before submitting transactions, confirm that `http://127.0.0.1:8114` is running and that the deployment records belong to that Devnet instance.

### 6.2. CLI Workflow

```powershell
# Create a new vault only when vault.json does not already exist.
pnpm exec tsx .\scripts\create-vault.ts

# Unlock the vault recorded in vault.json.
pnpm exec tsx .\scripts\unlock-vault.ts
```

`create-vault.ts` intentionally stops if `vault.json` already exists. Preserve this record instead of deleting it simply to bypass the guard.

If `unlock.json` already records an unlock transaction for the same vault, the script waits for that transaction instead of submitting another one.

### 6.3. Frontend Workflow

Check the frontend build and lint:

```powershell
pnpm --dir packages/vault-ui build
pnpm --dir packages/vault-ui lint
```

Start Vite:

```powershell
pnpm --dir packages/vault-ui dev
```

Open `http://localhost:5173`. If the port is occupied, stop the previous Vite process or explicitly use port 5174:

```powershell
pnpm --dir packages/vault-ui dev --port 5174
```

For that command, open `http://localhost:5174` and keep the terminal running.

1. Connect the demo signer.
2. If the account needs funds, run the funding command below in a second terminal.
3. Refresh the dashboard balance.
4. Create a 300 CKB vault, leave the recipient blank, and retain the exact secret.
5. Wait for confirmation and download `vault-ui.json`.
6. In the unlock panel, click **Lấy vault vừa tạo** (load the latest vault) or paste its JSON metadata.
7. Enter the same secret, click **Mở vault** (unlock vault), and wait for confirmation.

Demo funding command:

```powershell
pnpm exec tsx .\scripts\fund-demo.ts
```

The script sends a full 1,000 CKB when the demo balance is below 1,000 CKB, rather than sending only the shortfall. It skips funding when the balance is already sufficient.

localStorage is scoped to the origin, including the port. Switching from 5173 to 5174, or from `localhost` to `127.0.0.1`, may hide the previous record from the UI. Paste the saved `vault-ui.json` contents when needed. The current interface accepts JSON text; it does not include a file-upload importer.

## 7. Validation and Results

### 7.1. Devnet Workflow

| Scenario                           | Recorded result                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| CLI creation of a 300 CKB vault    | Confirmed during the exercise                                                     |
| Querying the newly created vault   | RPC returned `live`                                                               |
| CLI unlocking                      | Confirmed, with full 300 CKB repayment and separate fee capacity                  |
| Demo signer connection and funding | Confirmed by the implementer                                                      |
| UI vault creation                  | Confirmed by the implementer                                                      |
| UI unlocking                       | Screenshot shows confirmation, 300 CKB repayment, and the unlock transaction hash |
| Incorrect secret in the UI         | Implementer confirmed rejection before transaction submission                     |

An incorrect secret must be tested against a still-live vault. Once a vault has been unlocked, the UI rejects its spent outpoint before reaching secret validation.

**The incorrect-secret UI check demonstrates client-side validation.** It does not establish that an invalid-secret transaction was submitted to Devnet and rejected by the contract.

### 7.2. Contract Tests and Environment Checks

The original project report records **12 contract test cases**: one success and failures involving arguments, witness data, the secret, recipient, input ordering, fee payer, and underpayment. It also records an earlier screenshot showing 12 passing tests.

The original Codex report-preparation session recorded these checks:

| Check                                             | Result recorded in the original report                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Contract TypeScript                               | Passed, exit code 0                                                        |
| Frontend TypeScript                               | Passed, exit code 0                                                        |
| Jest rerun                                        | Could not verify the 12 cases because `ckb-debugger` was missing from PATH |
| Full build and lint during report preparation     | Not run                                                                    |
| New Devnet transactions during report preparation | Not run                                                                    |

These results are retained from the earlier report, not rerun during this README revision. Historical passing tests and a later environment failure are separate observations; no fresh test pass is claimed without a successful run.

## 8. Evidence

The original report lists these screenshots in an `Evidence` directory alongside `my-ckb-script`:

| Filename                  | Evidence                      |
| ------------------------- | ----------------------------- |
| `02_Contract_build.png`   | Contract build                |
| `03_Contract_running.png` | Earlier contract test results |
| `06_vault_create.png`     | CLI vault creation            |
| `07_vault_live.png`       | Live-cell query               |
| `08_unlock_vault.png`     | CLI vault unlocking           |
| `11_LockVaultUI.png`      | UI vault creation             |
| `12_UnlockVaultUI.png`    | UI vault unlocking            |
| `13_Account_balance.png`  | Demo signer and balance       |

These filenames are retained from the original report and were not checked against the project evidence directory during this revision. The submission package has not been verified to include a wrong-secret screenshot or a separate funding receipt.

If submitting the original directory layout, include the sibling `Evidence` directory. If submitting only the `my-ckb-script` repository, copy the screenshots into an internal `Evidence/` directory and use the corresponding relative paths. This README lists evidence filenames instead of embedding unverified image paths.

## 9. Issues Encountered

| Issue                                                | Resolution and lesson                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| pnpm blocked dependency build scripts                | Approve the required packages and rebuild using commands appropriate to the installed pnpm version |
| CCC could not resolve `AnyoneCanPay` and `NervosDao` | Add explicit Devnet KnownScript mappings with outpoints matching the local chain                   |
| Vite port 5173 was occupied                          | Stop the previous process or select port 5174                                                      |
| Wallet selection requested MetaMask                  | Use the local demo signer for the exercise                                                         |
| Confusion between faucet funds and Devnet funds      | Public Testnet funds belong to another chain; fund the local signer from a Devnet account          |
| Test rerun could not find `ckb-debugger`             | Restore the required tooling before claiming a fresh execution-test result                         |

These issues showed me that network and dependency configuration must remain consistent across contract deployments, CLI scripts, and the frontend. A `ckt` address does not make Testnet and Devnet balances interchangeable.

## 10. Limitations and Improvements

- The demo signer uses a public sample key in source and is suitable only for a disposable local environment. It must not hold real assets.
- Unlocking exposes the secret in the transaction witness, where it can be read from the transaction.
- The CLI uses a fixed demonstration secret. It could accept explicit input instead.
- Under the contract design described in the original report, the vault must occupy input 0 and additional inputs must use the recipient lock. Batch unlocking and independent fee sponsorship are not supported.
- The creation form accepts custom recipients, but the current UI connects only the fixed demo signer. Other recipients require an appropriate signing workflow.
- localStorage holds the latest creation record. Metadata should be downloaded before creating additional vaults.
- Submission guards prevent duplicate sends while the component is mounted. If confirmation fails after a transaction hash appears, inspect that hash before retrying.
- Resetting Devnet can invalidate deployment outpoints, system-script mappings, and saved vault records.
- Reproducibility would improve with complete Devnet startup instructions, pinned tool versions, the VM deployment command, and the remaining evidence.

## 11. Conclusion

In Week06, I implemented the Secret Vault workflow from contract logic to CLI scripts and a React interface on local CKB Devnet. The exercise demonstrates locking CKB with a secret hash, supplying the secret through a witness, and returning the full vault capacity while separate input capacity covers fees.

The implementation helped me connect lock arguments, witnesses, cell dependencies, and CCC transaction completion to a working browser workflow. Observed results, implementer-confirmed outcomes, and checks that were not rerun are recorded separately. The next improvements are a more reproducible environment, complete evidence, and broader wallet support.
