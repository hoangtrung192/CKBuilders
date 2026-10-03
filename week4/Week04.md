# CKBuilder Weekly Dev Log — Week 04

**Participant:** Daniel Do  
**Last updated:** October 3, 2026  
**Focus:** Node.js queries and TypeScript hash-lock development on OffCKB Devnet

## 1. Overview

This week, I continued the standalone Node.js exercises identified in my Week 3 goals and started implementing a CKB lock script in TypeScript.

My practical work focused on querying balances and live Cells, building a hash-lock contract, testing its validation rules, and deploying it with CKB JS VM. I used OffCKB Devnet to create a Cell containing 200 CKB and unlock it with the correct secret.

The main result was a complete local hash-lock exercise, from contract implementation to confirmed transactions and Cell-state verification. Payment-channel work remains scheduled for Week 5, and this exercise does not represent completion of the entire Intermediate curriculum.

## 2. Development Environment

- Windows and PowerShell
- Visual Studio Code
- Node.js v22.16.0, TypeScript, and pnpm v12.4.1
- OffCKB Devnet
- RPC endpoint: `http://127.0.0.1:8114`
- CCC SDK: `@ckb-ccc/ccc` for queries and `@ckb-ccc/core` v1.23.0 for the hash-lock CLI
- CKB JS VM and `@ckb-js-std` libraries
- Jest, `ckb-testtool` v1.0.5, and `ckb-debugger`

The current work is organized under:

- `week4/01_nodejs/` — balance and live Cell query scripts
- `week4/01_nodejs/Evidence/` — query screenshots
- `week4/script-labs/packages/on-chain-script/` — hash-lock contract
- `week4/script-labs/packages/on-chain-script-tests/` — contract tests
- `week4/script-labs/hashlock.ts` — Devnet create and unlock commands
- `week4/script-labs/deployment/` and `deployment-vm/` — public deployment metadata
- `week4/script-labs/evidence/` — test, deployment, and transaction screenshots

## 3. Progress Summary

| Task | Current status |
| --- | --- |
| Query CKB balance with Node.js | Completed |
| List live Cells and inspect their scripts and data | Completed |
| Create the CKB JS VM application workspace | Completed |
| Implement and build the TypeScript hash-lock | Completed |
| Test correct, wrong, and missing secrets | Completed; all 3 tests passed |
| Deploy contract bytecode and CKB JS VM | Completed on Devnet |
| Create a 200 CKB hash-lock Cell | Confirmed; output verified live |
| Unlock the Cell and return capacity | Confirmed; original output verified spent |
| Add malformed-input and multiple-input tests | Pending |
| Fiber payment-channel exercise | Deferred to Week 5 |
| Perun overview and comparison | Deferred to Week 5 |
| Type ID, Molecule, and sUDT exercises | Planned next |

The successful create and unlock results include both transaction confirmation and live Cell checks. The wrong-secret and missing-secret cases were verified through the local contract tests.

## 4. Node.js Query Practice

I implemented and ran [query_balance.ts](01_nodejs/query_balance.ts) to query an address through the local RPC.

**Recorded balance:**

```text
41,914,770.99909283 CKB
```

I also implemented [query_cells.ts](01_nodejs/query_cells.ts) to print each live Cell's OutPoint, capacity, lock args, optional type script, and data.

**Recorded live Cell query result:**

```text
Total live Cells: 7
Total capacity: 41,999,885.99909283 CKB
```

These values came from separate recorded runs and are not simultaneous balance measurements.

The Cell listing included an xUDT Cell from the earlier exercises. This helped connect the query output to the Cell Model: CKB capacity and token quantity are separate values, and the type script identifies the token represented by the data.

## 5. Hash-Lock Practice

### Contract and Tests

I replaced the generated template with a [hash-lock contract](script-labs/packages/on-chain-script/src/index.ts).

The contract reads the expected secret hash from script args after the 35-byte CKB JS VM loader prefix. It reads the secret from `WitnessArgs.lock` of the first input in the current script group, computes its CKB hash, and compares the result.

The contract returns:

- `0` — correct secret; spending allowed
- `1` — invalid expected-hash length
- `2` — missing, empty, or unreadable secret
- `3` — incorrect secret

The demonstration secret was `hello-ckb`. Its hash is stored in args, while the secret itself is supplied in the spending witness.

The [test fixture](script-labs/packages/on-chain-script-tests/src/index.test.ts) creates mock dependencies and an input Cell protected by the hash-lock. It verifies actual script execution for three spending cases:

| Test | Result |
| --- | --- |
| Correct secret | Passed; spending succeeds |
| Wrong secret | Passed; rejected with code `3` |
| Missing secret | Passed; rejected with code `2` |

**Test result:** 1 suite passed, 3 tests passed.

```powershell
pnpm build
pnpm --filter script-labs-tests exec jest --maxWorkers=1
```

### Deployment and Transactions

I deployed the compiled `index.bc` bytecode and the CKB JS VM executable separately. The lock points to the VM, while loader args identify the bytecode. Transactions include both deployed Cells as dependencies.

Both deployment records use `hashType: data2`. Type ID was disabled, so this deployment does not count as a Type ID exercise.

**Contract deployment transaction:**

```text
0x6128e85803282253daf60f98cdb8fe4f3351aced2df1ac521b3b78309c9d6289
```

**CKB JS VM deployment transaction:**

```text
0x537954670df3abddda910f13bfd650438605544bd8bfbd42d8137d7ffa3c3f16
```

I implemented [hashlock.ts](script-labs/hashlock.ts) with two commands:

- `create` — fund a 200 CKB hash-lock Cell, wait for confirmation, save its public OutPoint, and verify that it is live
- `unlock` — spend that Cell using the secret, return capacity to the wallet, and verify the old and new Cell states

**Create transaction:**

```text
0xa849d71aaca42f4b922cef31577e0f22f05dddb5061515d2737d3e194eed0d2d
```

**Unlock transaction:**

```text
0x5932ba17f9d14e51974d699db95560493ee5eb1cf19ac3af21987ca4d1f46069
```

The create transaction was committed and its 200 CKB output was live. After the unlock transaction was committed, the original Cell was spent and the wallet received **199.99999627 CKB**. The difference was an unlock fee of **0.00000373 CKB**.

These transaction hashes belong to the local Devnet, rather than public Testnet.

## 6. Debugging Log

| Problem | Investigation and resolution |
| --- | --- |
| `spawn pnpm ENOENT` during scaffold installation | Entered the generated workspace and ran `pnpm install` manually. |
| Ignored esbuild builds and obsolete pnpm configuration warning | The build subsequently succeeded. Clean-install verification and build-approval configuration remain follow-up work. |
| `ckb-debugger not found` during tests | Installed the Windows debugger executable and added it to the shell's PATH. |
| Unix-style environment assignment in the generated test command | Ran Jest directly through `pnpm --filter script-labs-tests exec jest --maxWorkers=1` in PowerShell. |
| Missing `AnyoneCanPay` and then `NervosDao` information | Exported Devnet system scripts and supplied the complete local KnownScripts configuration needed by the CLI. |
| Separate CKB JS VM dependency required | Deployed the VM executable supplied with `ckb-testtool` and included both VM and bytecode dependencies. |

## 7. What I Learned

I practiced the CKB validation model through a real spending condition. Creating a Cell establishes its lock; consuming that Cell causes the lock script to validate the transaction's witness.

I also connected script args, witnesses, code hashes, hash types, and Cell dependencies. The JavaScript bytecode and CKB JS VM have different roles, and pointing CCC at a local RPC does not automatically provide the correct Devnet script configuration.

Finally, I distinguished broadcast, confirmation, and resulting Cell state. For the hash-lock exercise, I checked that the created Cell was live and that it became spent after unlocking.

This is a learning contract: it checks knowledge of a secret without binding the spend to a designated recipient or requiring that recipient's signature. The secret is revealed in the spending witness. Recipient binding and a refund mechanism would require additional rules.

## 8. Evidence

Screenshots recorded during the exercises include:

- [Query_Balance.png](01_nodejs/Evidence/Query_Balance.png) — balance query
- [Querry_Cells.png](01_nodejs/Evidence/Querry_Cells.png) — live Cell listing
- [Test-pass.png](script-labs/evidence/Test-pass.png) — all three hash-lock tests passing
- [hash_lock.png](script-labs/evidence/hash_lock.png) — contract bytecode deployment
- [JSVM-deploy.png](script-labs/evidence/JSVM-deploy.png) — committed VM deployment
- [Hash_lock_create.png](script-labs/evidence/Hash_lock_create.png) — committed create transaction and live 200 CKB Cell
- [Hash_lock_unlock.png](script-labs/evidence/Hash_lock_unlock.png) — committed unlock transaction, spent original Cell, and returned capacity

Public code hashes and dependencies are recorded in [deployment/scripts.json](script-labs/deployment/scripts.json) and [deployment-vm/scripts.json](script-labs/deployment-vm/scripts.json).

## 9. Next Steps

1. **Start Week 5 with Fiber:** study payment channels, run two nodes, connect peers, open and verify a channel, and complete one payment. Capture node status, channel state, and payment results, together with the network and versions used.
2. **Cover Perun:** review its role in CKB payment channels and write a brief comparison with Fiber. Track this separately from the Fiber hands-on exercise.
3. **Reconcile Week 3 with the evidence already added:** the repository contains an xUDT balance check and transfer broadcast, Cluster and Spore queries, a Cluster transfer broadcast, and a Spore melt broadcast. Verify post-transfer token balances, the Cluster's final owner, and the absence of a live Spore after melting. A separate Spore transfer and ownership-verification result remains undocumented in the supplied evidence. Use existing transactions where possible; if the Devnet has been reset, record that and run a fresh lifecycle exercise.
4. **Improve the hash-lock project:** verify a clean dependency install, debugger PATH, pnpm build approvals, and a PowerShell-compatible test command. Add dedicated tests for malformed args and malformed or empty witnesses, then extend coverage to multiple-input script groups.
5. **Continue Intermediate scripting:** study UDT and Type ID concepts, practice Molecule serialization, and implement a small sUDT/Type ID exercise with success and rejection tests. Earlier xUDT CLI work does not replace these exercises.
6. **Define a small application MVP:** choose a token, Spore, or payment-channel use case and record its user flow, acceptance criteria, and remaining implementation work.
7. **Maintain the Week 8 target:** track the remaining Rust, WASM, debugging, ecosystem scripts, Nervos DAO, Spore, performance/cycles, and language-choice study across Weeks 6–8. These topics are not marked complete by this week's hash-lock exercise.
