# CKBuilder Weekly Report - Week 2

**Reporting period:** September 2026  
**Participant:** Daniel Do

---

## 1. Overview

Week 2 focused on moving from the basic CKB exercises completed in Week 1 toward application development using CCC (Common Chain Connector) and a simple frontend dApp.

The main goal was to understand how an application communicates with CKB Testnet, how wallet information can be accessed through CCC, and how on-chain data such as balances, live cells, and transactions can be queried from a user-facing application.

The work completed this week is organized into two main parts inside `week2/`:

- CCC fundamentals and transaction practice (`CCC/`)
- CKB learning dApp with wallet connection and on-chain queries (`02_Frontend/ckb-dapp/`)

All practical work in Week 2 was performed against CKB Testnet.

---

## 2. Week 2 Goals

- Understand the basic role of CCC in CKB application development.
- Learn the relationship between Client, Signer, Address, Transaction, and Cells.
- Practice building and sending a CKB transaction.
- Practice signing and verifying messages.
- Query CKB balances, live cells, and transactions.
- Build a simple frontend application that connects to a CKB wallet.
- Display wallet information and on-chain data inside the application.
- Understand how frontend applications communicate with CKB without requiring a traditional backend for every operation.

---

## 3. Development Environment

### Platform

- Windows 11
- PowerShell
- Node.js
- TypeScript
- React
- Vite

### CKB Environment

- CKB Testnet
- CCC SDK
- CCC React Connector
- Browser wallet integration

### Project Structure

The Week 2 work is organized into:

- `CCC/` — CCC learning exercises and evidence
- `02_Frontend/ckb-dapp/` — frontend CKB learning application
- `02_Frontend/ckb-dapp/evidence/` — screenshots showing completed application functions

---

## 4. Week 2 Work Summary

| Area                                    | Status    | Evidence                              |
| --------------------------------------- | --------- | ------------------------------------- |
| CCC Playground practice                 | Completed | `CCC/01_Playground.png`               |
| Build and complete CKB transaction      | Completed | `CCC/02_Transaction_Successfully.png` |
| Transfer CKB                            | Completed | `CCC/03_Transfer_CKB.png`             |
| Message signing and verification        | Completed | `CCC/04_SignSuccess.png`              |
| Query CKB balance                       | Completed | `CCC/05_CheckBalance.png`             |
| Query live cells                        | Completed | `CCC/06_QuerryCells.png`              |
| Query transactions                      | Completed | `CCC/07_Querry_Transactions.png`      |
| Signer practice                         | Completed | `CCC/8_Test_Signer.png`               |
| Build CKB learning dApp                 | Completed | `02_Frontend/ckb-dapp/`               |
| Connect browser wallet                  | Completed | `evidence/Connect_Wallet.png`         |
| Display wallet information              | Completed | `evidence/Query_Wallet.png`           |
| Query cells from frontend               | Completed | `evidence/Query_Cells.png`            |
| Query transaction history from frontend | Completed | `evidence/Query_Transactions.png`     |

---

## 5. CCC Fundamentals

### Objective

Become familiar with CCC and understand how it acts as the application layer between TypeScript applications and the CKB network.

### Activities

During this part, I practiced the main CCC concepts required for CKB application development:

- Connecting to CKB Testnet
- Working with a CKB signer
- Retrieving wallet and address information
- Checking CKB balance
- Building a transaction
- Completing transaction inputs and fees
- Sending CKB
- Signing and verifying messages
- Querying live cells
- Querying transactions

### Result

I successfully completed the CCC exercises and was able to interact with CKB Testnet through TypeScript.

The exercises showed that CCC provides a consistent interface for common CKB operations and reduces the amount of low-level blockchain handling required by the application.

### What I Learned

The most important lesson was understanding that CCC does not replace the CKB Cell Model. Instead, it provides easier abstractions for working with it.

Actions such as checking a balance or sending CKB still depend on underlying cells, lock scripts, transaction inputs, outputs, and fees.

The CCC exercises helped connect the Cell Model concepts learned in Week 1 with actual application development.

### Evidence

Evidence is available in the `CCC/` folder.

---

## 6. CKB Learning dApp

### Objective

Build a simple frontend application that connects to a browser wallet and displays real data from CKB Testnet.

### Features Completed

The learning dApp supports:

- Connecting a CKB wallet
- Disconnecting a wallet
- Displaying connected wallet information
- Displaying the wallet address
- Displaying CKB balance
- Querying another CKB Testnet address
- Querying live cells
- Querying transaction history

### Result

The frontend application successfully connected to a CKB wallet and retrieved on-chain information from CKB Testnet.

The application was also able to display individual live cells and transaction information rather than only showing a single wallet balance.

### What I Learned

This exercise helped me understand how a frontend dApp communicates with a blockchain network.

For read-only operations such as balance, cell, and transaction queries, the frontend can communicate with CKB through CCC without requiring a separate backend.

For operations that require authorization, the wallet acts as the signing layer. The application requests the operation, while the wallet remains responsible for user approval and signing.

This made the separation between the application, wallet, CCC, and CKB network much clearer.

### Evidence

Evidence is available in:

`02_Frontend/ckb-dapp/evidence/`

The evidence includes:

- Learning app running
- Wallet connection
- Wallet information query
- Cell query
- Transaction query

---

## 7. Understanding CKB Application Architecture

One of the main concepts I clarified during Week 2 was the role of each layer in a CKB application.

### Frontend

The frontend is responsible for:

- User interface
- Wallet connection
- Receiving user input
- Displaying blockchain data
- Requesting wallet-authorized actions

### CCC

CCC provides the application interface for:

- Communicating with CKB
- Working with addresses and scripts
- Querying blockchain state
- Building transactions
- Working with signers

### Wallet

The wallet is responsible for:

- Managing the user's keys
- Providing the user's address
- Approving operations
- Signing transactions when required

### CKB Network

CKB stores and validates:

- Cells
- Transactions
- Lock scripts
- Type scripts
- On-chain state

This helped me understand that not every blockchain application needs a traditional backend. A backend becomes useful when the application requires additional off-chain services such as databases, authentication, business logic, caching, indexing, notifications, or automated server-side processes.

---

## 8. Challenges

### 8.1 Understanding Balance in the Cell Model

At first, a wallet balance looks similar to an account-based blockchain balance.

After querying individual cells, I understood more clearly that the displayed balance is calculated from live cells controlled by the relevant lock script.

### 8.2 Understanding Client and Signer

It was important to separate the responsibilities of the network client and signer.

The client communicates with CKB, while the signer represents the identity that can authorize operations.

Understanding this distinction made transaction and wallet flows easier to follow.

### 8.3 Understanding Address and Lock Script

Another important concept was understanding that a CKB address represents information that can be converted into a lock script.

Blockchain queries are therefore closely connected to scripts and cells rather than only to the visible address string.

### 8.4 Frontend Wallet Integration

Using a browser wallet is different from directly using a private key in a local script.

The wallet keeps key management outside the frontend application and provides a safer signing flow for users.

### 8.5 Frontend vs Backend

I initially expected blockchain applications to always require a backend.

During Week 2, I learned that simple CKB queries and wallet interactions can be performed directly from the frontend through CCC.

A backend becomes necessary when the application has additional server-side requirements rather than simply because it interacts with blockchain.

---

## 9. Key Learning Outcomes

By the end of Week 2, I was able to:

1. Explain the purpose of CCC in CKB application development.
2. Work with a CKB Testnet client and signer.
3. Build and send a basic CKB transaction.
4. Sign and verify messages.
5. Query CKB balance.
6. Query live cells.
7. Query transaction history.
8. Connect a browser wallet to a React application.
9. Display blockchain information inside a frontend application.
10. Explain the relationship between addresses, lock scripts, cells, and balances.
11. Explain when a CKB application may or may not require a traditional backend.

---

## 10. Week 2 Development Log

| Date         | Activity                                                               | Result    |
| ------------ | ---------------------------------------------------------------------- | --------- |
| Sep 19, 2026 | CCC Playground: connect to CKB Testnet and explore basic CCC functions | Completed |
| Sep 19, 2026 | CCC: build and complete a basic CKB transaction                        | Completed |
| Sep 20, 2026 | CCC: transfer CKB on Testnet                                           | Completed |
| Sep 21, 2026 | CCC: sign and verify a message                                         | Completed |
| Sep 22, 2026 | CCC: query CKB balance                                                 | Completed |
| Sep 22, 2026 | CCC: query live Cells                                                  | Completed |
| Sep 22, 2026 | CCC: query transactions                                                | Completed |
| Sep 23, 2026 | CCC: practice working with a Signer                                    | Completed |
| Sep 23, 2026 | Mini dApp: connect browser wallet                                      | Completed |
| Sep 23, 2026 | Mini dApp: display wallet address and balance                          | Completed |
| Sep 23, 2026 | Mini dApp: query on-chain Cells                                        | Completed |
| Sep 23, 2026 | Mini dApp: query transaction history                                   | Completed |
| Next week    | Mini dApp: transfer CKB from the frontend                              | Planned   |
| Next week    | CCC / Spore: create a Spore                                            | Planned   |
| Next week    | Node.js scripts: query balance and list Cells                          | Planned   |
| Next week    | xUDT: mint 1,000 tokens and transfer 100 tokens                        | Planned   |
| Next week    | Spore: create Cluster, create Spore, query both                        | Planned   |
| Next week    | Spore: transfer Spore, transfer Cluster, melt Spore                    | Planned   |

---

## 11. Remaining Tasks

The following topics were not the main focus of this week's implementation and will be continued later:

- Build a more complete backend service for CKB applications
- Add database integration
- Explore more complex transaction flows
- Continue learning custom CKB Scripts
- Learn more about CKB-VM and script execution
- Build a more complete end-to-end CKB application

---

## 12. Final Reflection

Week 2 was an important transition from learning individual CKB concepts to understanding how those concepts are used inside an application.

Week 1 focused mainly on the Cell Model, transactions, scripts, capacity, and local Devnet exercises.

Week 2 connected those concepts to TypeScript and frontend development through CCC.

The biggest improvement in my understanding was realizing that wallet balance, cells, transaction history, and transaction construction are all different views of the same underlying CKB model.

I also gained a clearer understanding of blockchain application architecture. The frontend, wallet, CCC, backend, and blockchain each have different responsibilities, and a backend should only be introduced when it provides additional application-level value.

After completing Week 2, I am more comfortable with CCC, CKB Testnet interaction, wallet integration, and querying on-chain data from an application.

---

## 13. Week 3 Goals

Week 3 will focus on completing the remaining application exercises from the current CKB learning track before moving on to a larger self-built application.

The main goals are:

### 13.1 Complete the Mini dApp Flow

- Add CKB transfer directly from the frontend.
- Keep wallet connection, balance, Cell, and transaction queries working together.
- Record screenshots for each completed function.

### 13.2 CCC and Spore Practice

- Create a Spore using CCC.
- Understand the relationship between Spore, Cluster, Cell data, and ownership.
- Record the transaction hash and query the created object on-chain.

### 13.3 Node.js CKB Scripts

Create simple Node.js / TypeScript scripts for:

- Querying CKB balance.
- Listing live Cells for an address.

The purpose is to practice CKB interaction outside the browser frontend.

### 13.4 xUDT Practice

- Mint 1,000 test tokens.
- Query the token balance.
- Transfer 100 tokens to another address.
- Verify the sender and receiver balances after the transfer.

### 13.5 Complete the Spore Lifecycle

- Create a Cluster.
- Create a Spore inside the Cluster.
- Query both the Cluster and the Spore.
- Transfer the Spore.
- Transfer the Cluster.
- Melt the Spore.

### 13.6 Expected Outcome

By the end of Week 3, I aim to:

1. Complete the remaining CCC and frontend exercises.
2. Be able to interact with CKB from both browser and Node.js environments.
3. Understand the basic lifecycle of xUDT assets.
4. Understand the basic lifecycle of Spore and Cluster objects.
5. Collect clear evidence for each completed task in the weekly development log.
6. Be ready to start designing a small CKB application based on the CKBuilder Handbook.
