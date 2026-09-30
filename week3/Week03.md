# CKBuilder Weekly Dev Log — Week 03

**Participant:** Daniel Do  
**Last updated:** September 30, 2026  
**Focus:** xUDT issuance and Spore/Cluster lifecycle on OffCKB Devnet

## 1. Overview

This week, I continued the application exercises identified in my Week 2 goals, using the CKBuilder Handbook, the reference project, and CCC documentation.

My practical work focused on issuing xUDT tokens and building TypeScript scripts for Spore and Cluster operations. I used a local OffCKB Devnet to practice transaction construction, signing, broadcasting, script configuration, and capacity management.

The most useful part of this week was debugging actual transaction problems and connecting them to the CKB Cell Model.

## 2. Development Environment

- Windows 11 and PowerShell
- Visual Studio Code
- Node.js, TypeScript, and pnpm
- OffCKB Devnet
- RPC endpoint: `http://127.0.0.1:8114`
- CCC SDK: `@ckb-ccc/ccc`
- Spore SDK: `@ckb-ccc/spore`

The current work is organized under:

- `week3/02_xDT/` — xUDT issuance and transfer practice
- `week3/03_Spore/` — Cluster and Spore scripts
- `week3/03_Spore/Evidence/` — screenshots from the exercises

## 3. Progress Summary

| Task                                                | Current status                                               |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Start and connect to OffCKB Devnet                  | Completed                                                    |
| Issue 1,000 xUDT units                              | Completed                                                    |
| Read a local key and verify the signer address      | Completed                                                    |
| Configure Devnet script dependencies                | Completed                                                    |
| Transfer 100 xUDT                                   | Deferred; balance verification remains pending               |
| Create a Cluster                                    | Transaction broadcast successfully                           |
| Prepare Cluster query and transfer scripts          | Implemented                                                  |
| Create a text Spore inside the Cluster              | Transaction broadcast successfully                           |
| Query, transfer, and melt the Spore                 | Scripts implemented; execution results remain to be recorded |
| Standalone Node.js balance and Cell query exercises | Planned next                                                 |

A transaction hash confirms successful broadcast. Query results are still needed to verify the corresponding committed on-chain state.

## 4. xUDT Practice

I successfully issued 1,000 xUDT units using OffCKB:

```powershell
offckb.cmd udt issue 1000 --network devnet --udt-kind xudt --privkey-file ".\a.key"
```

**Issue transaction hash:**

```text
0xa7771e72b10f427c0b46adcbd0cd4b2cb6a2879d60cd58e99cbfe7e50995ab87
```

**Token type args:**

```text
0x4472b33b4e1845ebe82f2ce5f511bbe012f144c5f3d7b539909adffc83ccda61
```

I also ran a TypeScript script that read the local key, created a signer, and printed the expected sender address.

This exercise clarified the distinction between token quantity and CKB capacity. Token quantity is stored in Cell data, while capacity provides the storage required for the Cell to exist. The token’s full type script identifies which asset the Cell contains.

The 100-token transfer remains unfinished. I will verify the token balance and complete the transfer separately.

## 5. Cluster and Spore Practice

### Cluster

I prepared and ran `create_cluster.ts` to create a collection named:

```text
Daniel CKBuilder Week 03
```

**Cluster ID:**

```text
0x7a0071852af5b2e0b6e8e151f2a10f13262ac816e93265ce804d22194aa34789
```

I also prepared scripts to query the Cluster and transfer its ownership to another Devnet address.

### Spore

I implemented a command-based `spore.ts` script supporting:

- `create` — create a text Spore associated with the Cluster
- `query` — display content, owner, Cluster ID, and OutPoint
- `transfer` — transfer the Spore to another address
- `melt` — consume the Spore and release its capacity

After fixing configuration and capacity problems, the create command successfully broadcast a transaction.

**Spore ID:**

```text
0x46c022cb3bf999a6049f9646317a3beb7c89d4ebbf38e3e35bf18a074f662954
```

The next verification steps are to query the created Spore, confirm the new owner after transfer, and confirm that no live Spore remains after melting.

## 6. Debugging Log

| Problem                                | Investigation and resolution                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch failed` during xUDT issuance    | The Devnet node was not running. Port 8114 refused connections. Starting OffCKB resolved the connection problem.                                                        |
| pnpm/esbuild installation issue        | Reviewed dependency build approval and confirmed that the TypeScript signer script could run.                                                                           |
| `ERR_MODULE_NOT_FOUND`                 | Corrected mismatched filenames and created the missing `spore.ts` file.                                                                                                 |
| Read-only property `V2`                | Removed an attempted mutation of the SDK’s predefined Cluster configuration.                                                                                            |
| Custom Devnet Cluster lookup           | Supplied the Devnet script information directly and prepared the Cluster ownership proof in the transaction.                                                            |
| `Insufficient CKB, need 245 extra CKB` | The proxy output preserved the input’s entire capacity. Replaced it with a minimum-capacity output, allowing the remaining capacity to fund the Spore, fee, and change. |

## 7. What I Learned

I gained a clearer understanding of how script code hashes, hash types, and Cell dependencies work together. Connecting CCC to a local RPC does not automatically make its default public-network script configuration suitable for Devnet.

The capacity error also showed why transaction inputs and outputs must be inspected carefully. A transaction can consume a funded input but still lack available capacity if another output reserves all of it.

Finally, I practiced following ownership through transactions. After an asset is transferred, the new owner’s signer must authorize subsequent spending. A key that created an asset does not retain spending authority after ownership changes.

## 8. Evidence

Screenshots recorded during the Cluster exercises include:

- `Evidence/Create_cluster.png`
- `Evidence/Query_Cluster.png`
- `Evidence/Transaction_success.png`

Additional terminal evidence shows successful xUDT issuance, the expected signer address, the Spore creation broadcast, and the debugging errors described above.

I will add the remaining query, transfer, and melt results as those steps are verified.

## 9. Next Steps

1. Query the newly created Spore and verify its content and owner.
2. Transfer the Spore and verify the ownership change.
3. Melt the Spore and verify that its live Cell no longer exists.
4. Complete the deferred xUDT balance check and 100-token transfer.
5. Continue the standalone Node.js exercises for balance queries, live Cell listing, and CKB transfers.
6. Use the completed exercises to inform the design of a small CKB application.
