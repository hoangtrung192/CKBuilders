# CKBuilder Weekly Dev Log — Week 05

**Participant:** Daniel Do

**Last updated:** October 14, 2026

**Focus:** Fiber payment channels, Perun research, and an epoch-based timelock on CKB Testnet

## 1. Overview

This week, I completed the Fiber exercise deferred from Week 4. I ran two native Windows nodes, connected them, funded a channel, sent a 100 CKB payment, and cooperatively closed the channel. Both the funding and settlement transactions were confirmed on CKB Testnet.

I also reviewed Perun's role in CKB channels and compared its framework with Fiber. This was research only; I did not deploy Perun contracts or run a Perun channel.

For additional scripting practice, I created a 200 CKB timelock Cell using the existing multisig system script. Spending before maturity was rejected with `Immature`; spending after maturity succeeded and consumed the original Cell.

These results complete the practical work described below. The remaining Week 3 checks, Week 4 test improvements, sUDT, Type ID, Molecule, and MVP work remain pending. The target is still to complete Intermediate by the end of Week 8.

## 2. Development Environment

| Component | Version or configuration used |
| --- | --- |
| Workspace | `G:\neon`, repository `hoangtrung192/CKBuilders` |
| Operating environment | Windows x64, PowerShell, Visual Studio Code |
| Node.js | v22.16.0 |
| Fiber node | v0.9.1, commit `9a561b3`, build date September 10, 2026 |
| Fiber CLI | v0.9.1 |
| CKB CLI | v1.12.0, commit `278c7be` |
| CCC core | `@ckb-ccc/core` v1.23.0, reused from Week 4 |
| Practice network | CKB Testnet |
| CKB RPC | `https://testnet.ckbapp.dev/` |
| Node A RPC / P2P | `127.0.0.1:8227` / `127.0.0.1:8228` |
| Node B RPC / P2P | `127.0.0.1:8237` / `127.0.0.1:8238` |

Fiber used the [official v0.9.1 release](https://github.com/nervosnetwork/fiber/releases/tag/v0.9.1) and its [Testnet configuration](https://github.com/nervosnetwork/fiber/blob/v0.9.1/config/testnet/config.yml). Both nodes had separate identities and funding accounts, with manual channel acceptance. Native Windows binaries made a WSL installation unnecessary for this exercise.

The previous OffCKB Devnet RPC, `http://127.0.0.1:8114`, was not used for these transactions. The RPC helper and timelock preparation script check the Testnet genesis hash before proceeding.

The scripts created for this work are:

- [fiber/Install-FiberTestnetNode.ps1](fiber/Install-FiberTestnetNode.ps1) — installation wrapper pinned to v0.9.1, with an existing-directory guard.
- [fiber/Set-FiberTestnetPorts.ps1](fiber/Set-FiberTestnetPorts.ps1) — separate node ports and manual acceptance configuration.
- [fiber/Fiber-Rpc.ps1](fiber/Fiber-Rpc.ps1) — RPC helpers for node, peer, channel, invoice, and payment queries.
- [fiber/README.md](fiber/README.md) — PowerShell practice instructions.
- [timelock/prepare.cjs](timelock/prepare.cjs) — public address preparation and epoch-maturity checks; signing was performed separately through CKB CLI.

## 3. Progress Summary

| Task | Current status |
| --- | --- |
| Run two Fiber nodes with separate ports and identities | Completed on Windows |
| Connect peers in both directions | Completed |
| Open and manually accept a channel | Completed; both nodes reached `ChannelReady` |
| Confirm channel funding | Completed; 1,000 CKB funding output committed |
| Send one 100 CKB payment from A to B | Completed; sender `Success`, receiver invoice `Paid` |
| Check channel balances after payment | Completed; balances mirrored correctly, no pending TLCs |
| Cooperatively close and settle the channel | Completed; `Closed`, settlement committed |
| Review Perun and compare it with Fiber | Completed as research |
| Run a Perun channel | Not performed |
| Create and spend a timelock Cell | Completed; committed transactions and consumed input verified |
| Attempt spending before maturity | Completed; rejected with `Immature` |
| Verify Week 3 post-transfer balances, ownership, and melt state | Pending |
| Reinstall, rebuild, and expand Week 4 hash-lock tests | Pending; earlier results do not count as a fresh run |
| sUDT, Type ID, and Molecule hands-on exercises | Pending |
| Agree MVP scope and acceptance criteria, then build it | Pending |

The checklist created at the start of the session contains earlier intermediate statuses. This report records the later verified outcomes; no new evidence files were exported while preparing it.

## 4. Fiber Payment-Channel Practice

### Setup and Funding

A payment channel locks funds on-chain, allows participants to update balances off-chain, and eventually settles those balances on-chain. A channel becomes usable after funding confirmation and completion of the channel protocol; submitting `open_channel` alone is insufficient.

I connected A and B, then opened a bidirectional channel with **500 CKB from each participant**. Equal contributions were a choice for this demonstration, rather than a general requirement for channels.

**Channel ID:**

```text
0xbf5f689c0bc527cb4c42bd3b70641e036fb392b66636c18d67201d83e6e12344
```

**Funding transaction — committed, output index 0 contains 1,000 CKB:**

```text
0x2cd056562d7c6d29431bc23f22d40bfbbb19343c9c6dc5c5c62073e0b90f272e
```

The channel reported 401 CKB of local balance on each side before payment. The remaining 99 CKB per participant was reserved, so the channel's reported balances were smaller than the gross funding contributions.

### Off-Chain Payment

Node B created a `Fibt` invoice for 100 CKB. Node A paid it. The final sender status was **`Success`**, the invoice status was **`Paid`**, and the recorded off-chain payment fee was **0 CKB**.

**Payment hash — an off-chain payment identifier, not a CKB transaction hash:**

```text
0xed0da5226e27d881d48fa0027968446ce73bdfa35e206fe8c68ef00385a2c821
```

| Channel balance | Before payment | After A paid B |
| --- | --- | --- |
| A: local / remote | 401 / 401 CKB | 301 / 501 CKB |
| B: local / remote | 401 / 401 CKB | 501 / 301 CKB |

The mirrored balances agreed, and there were no pending TLCs after completion. The channel supported payments in either direction, but the verified payment in this session was A → B; a reverse payment is not claimed here.

### Cooperative Settlement

I requested cooperative shutdown with `force: false`. A subsequent RPC check showed **`Closed`** with the **`COOPERATIVE`** flag.

**Settlement transaction — committed:**

```text
0x3e936e8157c9642860d5cbd588671e086e7a50b33002c33b6ee74263f7e1c9e7
```

The transaction consumed the original funding output and returned:

| Recipient | Settlement capacity |
| --- | --- |
| Node A funding account | 399.99999472 CKB |
| Node B funding account | 600 CKB |
| Closing fee | 0.00000528 CKB, or 528 shannons |

This matches the original 500/500 contributions followed by a 100 CKB payment from A to B, with the closing fee deducted from A's output. The zero off-chain payment fee does not imply that funding or settlement transactions were free.

## 5. Perun Research and Timelock Practice

### Perun's Role on CKB

Perun provides a blockchain-independent state-channel framework through [go-perun](https://github.com/hyperledger-labs/go-perun). Its [CKB backend](https://github.com/perun-network/perun-ckb-backend) connects that framework to CKB, supporting payment channels, signed off-chain updates, sUDT assets, and on-chain disputes. The corresponding [CKB contracts](https://github.com/perun-network/perun-ckb-contract) enforce channel state transitions and control locked funds.

| Aspect | Fiber | Perun |
| --- | --- | --- |
| Main approach | Payment-channel network with nodes, peers, invoices, and payment RPCs | State-channel framework with chain-specific backends and contracts |
| Tools reviewed or used | Rust node, native Windows binaries, `fnn-cli`, JSON-RPC | Go framework/backend and CKB on-chain contracts |
| This week's environment | Two local nodes connected to CKB Testnet | Documentation and environment review only |
| Verified result | Funding, payment, balance update, cooperative settlement | Conceptual comparison; no practical channel result |

The available machine had no installed WSL distribution, and the checked terminal lacked Go and several tools used by Perun's documented Linux setup. The backend instructions also specify CKB CLI v1.13.0 or newer, whereas the Fiber installation supplied v1.12.0. Ubuntu is a possible environment for following those instructions, not a universal protocol requirement. I deferred the practical setup instead of treating documentation review as a successful demo. These requirements are documented in the [backend development guide](https://github.com/perun-network/perun-ckb-backend#development).

### Epoch-Based Timelock

I used a **1-of-1 legacy secp256k1 multisig lock with a `since` condition**. This combines the owner's signature with a maturity requirement. The [multisig script](https://github.com/nervosnetwork/ckb-system-scripts/blob/master/c/secp256k1_blake160_multisig_all.c) binds the required `since` value in its args, and CKB consensus checks input maturity under the [transaction `since` rules](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md).

The preparation script targeted approximately 40 blocks ahead using an absolute epoch fraction. This is a chain-based deadline, so it does not promise a precise number of wall-clock minutes.

```text
Unlock epoch: 0x70805610036b3
Input since:  0x20070805610036b3
Locked capacity: 200 CKB
```

**Create transaction — committed, timelock output index 0:**

```text
0xff4a74b45e038064297cc05461dda5b2eb707774fb8942c29df6ac06f2db6f3c
```

| Case | Expected behavior | Observed result |
| --- | --- | --- |
| Spend before maturity | Reject transaction | `TransactionFailedToVerify` with `Immature` for input 0 |
| Check before deadline | `ready: false` | Recorded at epoch `0x708054b0036b3` |
| Check after deadline | `ready: true` | Recorded at epoch `0x70805b40036b3` |
| Spend after maturity with owner signature | Accept and consume locked Cell | Transaction committed and referenced the exact original output |

**Spend transaction — committed:**

```text
0x8086322f0dfbd7edb9f8cdfe8a5157f845ce3468b0fcea47acb7b4bf4295992c
```

The spending transaction had one input: the 200 CKB timelock Cell, with the required `since` value. It created **100 CKB** and **99.99999512 CKB** outputs, both under the owner's ordinary lock. The total returned was **199.99999512 CKB**, with a fee of **0.00000488 CKB**.

A later `get_live_cell` query returned `unknown` for the original output. Together with the committed transaction that explicitly consumes it, this verifies that the original Cell is no longer live. This exercise used an existing system script; it did not deploy a new custom contract or implement a complete HTLC with secret-claim and refund branches.

## 6. Debugging Log

| Observation | Investigation or outcome |
| --- | --- |
| Node A displayed repeated gossip synchronization warnings | These were distinct from a process crash. Peer, channel, and payment RPC results were used to verify that the exercise could proceed. No underlying gossip fix is claimed. |
| Two nodes needed separate endpoints | Configured A at RPC/P2P 8227/8228 and B at 8237/8238, with manual acceptance. |
| Earlier instructions expected payment status `Succeeded` | The actual v0.9.1 result was `Success`; verification used the observed status and receiver's `Paid` invoice. |
| Channel opening and shutdown did not finish immediately | Waited for `ChannelReady`, then later `Closed` and a committed settlement transaction. Intermediate screenshots alone were insufficient. |
| Timelock spend failed before the deadline | The `Immature` error was the intended rejection case. Retried only after maturity; no chain reset or key replacement was needed. |
| Perun prerequisites differed from Fiber's Windows setup | Deferred hands-on Perun work and recorded the environment/version gaps separately from research. |

## 7. What I Learned

I followed a channel's full lifecycle: funding, readiness, off-chain balance updates, and on-chain settlement. The payment hash identifies the off-chain payment, while funding and closing have separate CKB transaction hashes. Reserved capacity also explains why gross deposits and channel balances differ.

The timelock exercise connected script args, input `since`, epoch fractions, signature authorization, and transaction maturity. A rejected early spend was a useful validation result. A successful broadcast still needed confirmation and a check that the intended Cell was consumed.

I also learned to distinguish a payment-network exercise from researching a state-channel framework. Reading Perun documentation and preparing code do not establish that its channel workflow has been executed successfully.

## 8. Evidence

The following existing screenshots were reviewed for this report. No additional screenshots or RPC evidence exports were created during report preparation.

| Evidence | What it shows |
| --- | --- |
| [01_nodeA.png](evidence/fiber/01_nodeA.png) | Node A version output |
| [02_nodeB_config.png](evidence/fiber/02_nodeB_config.png) | Node B ports and configuration |
| [03_nodeA_running.png](evidence/fiber/03_nodeA_running.png) | Node A startup |
| [04_nodeB_running.png](evidence/fiber/04_nodeB_running.png) | Node B startup |
| [05_Peer.png](evidence/fiber/05_Peer.png) | Peer connection visible on both nodes |
| [06_Channel_ready.png](evidence/fiber/06_Channel_ready.png) | Despite the filename, the captured state is `AwaitingChannelReady` |
| [07_Offchain_Payment.png](evidence/fiber/07_Offchain_Payment.png) | Invoice, sender `Success`, receiver `Paid` |
| [08_Channel_Shutdown.png](evidence/fiber/08_Channel_Shutdown.png) | `ShuttingDown` and waiting for commitment confirmation, rather than final closure |
| [01_lockCKB.png](evidence/LockSmc/01_lockCKB.png) | Timelock plan, create transaction, and 200 CKB capacity query |
| [02_Unlock_beforedl.png](evidence/LockSmc/02_Unlock_beforedl.png) | Early spend rejected with `Immature` |
| [03_Checkdl.png](evidence/LockSmc/03_Checkdl.png) | Maturity check returning `ready: false` |
| [04_Ready_for_spend.png](evidence/LockSmc/04_Ready_for_spend.png) | Maturity check returning `ready: true` |
| [05_Spend.png](evidence/LockSmc/05_Spend.png) | Successful spending submission and transaction hash |

Final `ChannelReady`, mirrored balances, and cooperative `Closed` were checked through Fiber RPC during the session. Funding, settlement, and both timelock transactions were independently checked through Testnet `get_transaction`; the timelock input was also queried through `get_live_cell`. Those checks were read-only and were not exported as new evidence files. No private keys, seeds, or passwords are included in this report.

## 9. Next Steps

1. **Week 6 — finish outstanding verification:** query Week 3 xUDT balances after transfer, Cluster and Spore ownership after transfer, and the original Spore's non-live state after melt. Reuse existing transactions where possible and repeat only work that lacks usable evidence. The unrelated `E:\ckbuilder` project is outside this repository's progress.
2. **Week 6 — complete hash-lock follow-up:** verify dependency installation, pnpm configuration, debugger PATH, build, and tests. Add explicit wrong-args, malformed/empty-witness, and multiple-input script-group cases with expected outcomes.
3. **Week 6 — practice Intermediate concepts:** implement sUDT mint/transfer, Type ID creation/update, and Molecule encode/decode. Include success and rejection cases; previous xUDT work and Type ID-disabled deployments do not replace these exercises.
4. **Week 6 — define the MVP:** choose a small token, Spore, or Fiber invoice application and agree its scope and acceptance criteria before implementation. A two-node Fiber invoice/payment viewer is now a concrete candidate, but no MVP scope has been approved or built.
5. **Weeks 6–7 — optional Perun practical extension:** prepare a suitable isolated environment, pin compatible tools and repositories, and verify opening, updating, and closing a channel. Track this separately from the completed research.
6. **Week 7 — build the agreed MVP and continue the remaining curriculum:** cover Rust/CKB-VM, WASM, debugging, and relevant ecosystem scripts, including Nervos DAO and Spore, according to the remaining course requirements.
7. **Week 8 — validate and demonstrate:** review the Intermediate checklist, measure cycles/performance where relevant, document language choices, and produce a reproducible final demo. Completion will be based on actual exercise results, not the existence of code or this schedule.
