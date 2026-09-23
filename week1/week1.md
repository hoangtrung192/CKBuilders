# CKB Weekly Report - Week 1

**Reporting period:** September 2026
**Participant:** Daniel Do

---

## 1. Week 1 Overview

The main goal of Week 1 was to become familiar with the Nervos CKB ecosystem, understand the basic CKB architecture and Cell Model, set up a local development environment, and complete a series of beginner-level CKB exercises.

During this week, I focused on both theoretical understanding and hands-on development. Instead of only reading the documentation, I ran the examples locally, interacted with a CKB Devnet, created and transferred assets, stored data in cells, and built and deployed a custom Hash Lock contract.

The main topics and exercises covered during Week 1 were:

* Getting Started with CKB and OffCKB
* CKB Devnet
* Transfer CKB
* Store Data on Cell
* Create Fungible Token (xUDT)
* Create DOB / Spore
* Simple Lock / Hash Lock
* CKB Cell Model
* Capacity
* Lock Script and Type Script
* CKB transactions and Inputs / Outputs
* CKB RPC and Devnet interaction

---

## 2. Development Environment

My development environment for Week 1 was based on Windows and a local CKB Devnet.

### Tools

* OS: Windows 11
* Node.js: Installed and used for the CKB examples
* pnpm: Used for installing and running the Simple Lock project
* OffCKB: Used to manage the local CKB Devnet
* CKB Devnet RPC: `http://127.0.0.1:8114`
* Frontend development server: `http://localhost:3000`
* Repository: `G:\neon\week1\docs.nervos.org`

The CKB examples were obtained from the Nervos documentation repository:

```text
https://github.com/nervosnetwork/docs.nervos.org
```

---

## 3. CKB Fundamentals

Before working with the examples, I spent time understanding the basic concepts behind CKB.

### Cell Model

The Cell Model is the fundamental state model of CKB.

Instead of storing a simple account balance, CKB represents blockchain state using Cells.

A transaction consumes existing Cells as inputs and creates new Cells as outputs.

Conceptually:

```text
Input Cells
     ↓
 Transaction
     ↓
Output Cells
```

This helped me understand that a CKB transaction is essentially a state transition between sets of Cells.

### Capacity

Capacity represents the amount of CKBytes associated with a Cell.

An important concept I learned is that capacity is not simply an account balance. A Cell needs enough capacity to cover the storage occupied by its scripts and data.

This became especially clear while working with the Simple Lock example. A transaction can fail even when the numerical amount of CKB appears sufficient because the transaction also needs enough capacity for the newly created Cells and transaction fee.

### Transaction

A CKB transaction consumes existing input Cells and creates new output Cells.

The basic structure can be viewed as:

```text
Inputs
  ↓
Transaction
  ↓
Outputs
```

The transaction also contains the information required for scripts to validate whether the state transition is allowed.

### Input / Output

An Input references an existing Cell that will be consumed.

An Output represents a newly created Cell.

For example, when transferring CKB:

```text
Input Cell
   ↓
Transaction
   ├── Receiver Cell
   └── Change Cell
```

This was particularly useful when debugging the Simple Lock transaction.

### Lock Script

A Lock Script defines the conditions required to unlock and consume a Cell.

It can be thought of as the authorization mechanism of a Cell.

In the Hash Lock example, the Lock Script verifies whether the correct preimage has been provided.

### Type Script

A Type Script is an optional script associated with a Cell.

While the Lock Script is primarily related to spending authorization, Type Scripts can enforce rules about the Cell's data and state transitions.

This distinction became important when learning about xUDT and other CKB applications.

### Cell Data

A Cell can contain arbitrary data.

This allows CKB Cells to be used not only for holding CKB but also for storing application-specific state and other on-chain information.

This concept was demonstrated directly through the Store Data on Cell exercise.

### RPC

RPC provides an interface between applications/tools and a CKB node.

Through RPC, applications can query blockchain state and submit transactions.

The local Devnet therefore acts as the blockchain environment while the dApps communicate with it through the RPC endpoint.

---

# 4. Exercise 00 - Getting Started

## Objective

The objective was to install the required CKB development tools, start a local CKB Devnet, and become familiar with the development accounts provided by OffCKB.

## Procedure

I installed and configured OffCKB and used it to start a local Devnet.

The main commands I used included:

```powershell
offckb node
```

and:

```powershell
offckb accounts
```

The Devnet provided pre-funded development accounts that could be used for the following exercises.

I also learned how to distinguish the local Devnet environment from public CKB networks such as Testnet.

## Result

The local CKB Devnet was successfully started and became available through:

```text
http://127.0.0.1:8114
```

The development accounts could then be inspected and used for testing.

## What I Learned

I learned how a local blockchain development environment is created using OffCKB.

More importantly, I learned that the network environment matters when working with accounts and transactions. An account funded on Devnet cannot simply be assumed to have funds on another network.

---

# 5. Exercise 01 - Transfer CKB

## Objective

The objective was to understand how CKB can be transferred between development addresses and how transactions can be submitted through the command line.

## Procedure

I used OffCKB to interact with the local Devnet and transfer CKB between development addresses.

I also learned the required syntax for using a private key with the transfer command:

```powershell
offckb transfer --network devnet --privkey "PRIVATE_KEY" "ADDRESS" 500
```

The private key was used locally and was not included in the project source code.

I also checked account information using OffCKB commands and observed the resulting transactions.

## Result

The CKB transfer was successfully submitted to the local Devnet.

This exercise gave me my first practical experience with:

* Devnet accounts
* CKB addresses
* Private keys
* Transaction submission
* Transaction hashes
* CKB balances

## What I Learned

I learned that a CKB transfer is not simply a balance update.

Behind the transfer, CKB consumes an existing Cell and creates new output Cells.

This connected the theoretical Cell Model with an actual transaction.

---

# 6. Exercise 02 - Store Data on Cell

## Objective

The objective was to understand how arbitrary application data can be stored inside a CKB Cell and later retrieved.

## Procedure

I ran the Store Data on Cell example locally and interacted with it through the frontend.

The exercise involved writing data into a Cell and subsequently reading the stored data.

The important concept was that the Cell contains not only capacity and scripts but can also contain application-specific data.

## Result

The data was successfully written to the Devnet and retrieved from the Cell.

## What I Learned

This exercise helped me understand one of the major differences between the CKB Cell Model and a simple account-based model.

A Cell can represent both:

```text
Value + Script + Data
```

This makes Cells useful for representing application state directly on-chain.

---

# 7. Exercise 03 - Create Fungible Token (xUDT)

## Objective

The objective was to understand how a fungible token can be represented using CKB Cells and how xUDT works at a basic level.

## Procedure

I ran the xUDT example and created a custom fungible token on the local Devnet.

I then queried the token information and performed a token transfer.

The exercise helped me understand the relationship between:

```text
Cell
 +
Type Script
 +
Token Data
```

## Result

The custom token was successfully created and could be queried through its token information.

A token transfer was also performed successfully.

## What I Learned

I learned that an xUDT token is not represented as a simple account balance.

Instead, token balances are represented through Cells and validated by scripts.

I also learned that the token's script arguments can be used to identify a particular token.

This helped me understand how CKB can support different asset standards while maintaining the Cell Model.

---

# 8. Exercise 04 - Create DOB

## Objective

The objective was to understand how Digital Objects can be created and represented using CKB Cells.

## Procedure

I ran the Create DOB example locally and used a development account to create a DOB/Spore object.

The exercise involved storing content in a CKB Cell and then checking the content from the blockchain state.

## Result

The DOB was successfully created on the local Devnet and its content could be verified.

## What I Learned

The main concept I learned from this exercise was the relationship between:

```text
Cell Capacity
        +
Cell Data
        +
Application Content
```

Larger data requires more storage and therefore affects the capacity required by the Cell.

This helped me understand that CKB's capacity is closely connected to on-chain storage.

---

# 9. Exercise 05 - Simple Lock / Hash Lock

## Objective

The objective was to build and deploy a custom Hash Lock contract, interact with it through a Next.js frontend, and understand how a Cell can be unlocked by providing the correct preimage.

## Procedure

I cloned the official documentation repository and worked directly with the Simple Lock example.

The project was located at:

```text
G:\neon\week1\docs.nervos.org\examples\dApp\simple-lock
```

I installed the dependencies using:

```powershell
pnpm install
```

I then built the Hash Lock contract.

During the build process, I encountered a Windows compatibility problem because the build script attempted to execute:

```text
./node_modules/.bin/esbuild
```

This command worked differently on Unix-like environments and failed when executed through the Windows command shell.

I modified the build command to execute esbuild through Node:

```text
node node_modules/esbuild/bin/esbuild
```

After fixing the build command, the contract could be compiled successfully.

The contract was then deployed to the local Devnet.

I used:

```powershell
offckb deploy --network devnet --target .\dist --output .\deployment
```

The deployment produced a transaction hash and generated deployment artifacts such as:

```text
deployment/scripts.json
```

The deployment artifacts were then synchronized with the frontend.

## Hash Lock Flow

The frontend allows a user to provide a preimage.

For example:

```text
Preimage:
Hello World
```

The application generates a hash from the preimage and uses the resulting information to construct a Hash Lock address.

The general flow is:

```text
Preimage
   ↓
Hash
   ↓
Hash Lock Address
   ↓
Deposit CKB
   ↓
Reveal Preimage
   ↓
Hash Lock Script verifies preimage
   ↓
Cell can be spent
```

## Deposit

I successfully deposited CKB into the generated Hash Lock address.

The frontend showed the deposited capacity in the Hash Lock Cell.

At one point, the Hash Lock Cell contained:

```text
150 CKB
```

## Reveal and Transfer

I then attempted to reveal:

```text
Hello World
```

and transfer CKB from the Hash Lock Cell.

The transaction initially failed with:

```text
There is not enough capacity to create valid recipient and change cells and pay the transaction fee.
```

This was an important practical lesson because it showed that having a numerical CKB balance does not automatically mean that a transaction can create arbitrary output Cells.

The transaction needs sufficient capacity for:

* Recipient Cell
* Change Cell
* Transaction fee
* Storage required by the associated scripts

I then tested a smaller transfer amount.

The transfer command itself was successfully executed in a separate funding step, producing the transaction:

```text
0x59b4071cc88b10fbe07b2c81cd22f439027fe3346d821eb78531360348a81b83
```

I also used the OffCKB debug functionality to inspect the transaction:

```powershell
offckb debug --tx-hash 0x59b4071cc88b10fbe07b2c81cd22f439027fe3346d821eb78531360348a81b83 --network devnet
```

The result was:

```text
=== Input[0].Lock ===

Run result: 0
All cycles: 1619532(1.5M)
```

This confirmed that the Lock Script execution for the inspected input returned success.

The final reveal-and-transfer flow is still being completed because the frontend transaction requires sufficient capacity for both the recipient and change Cells.

## What I Learned

The Simple Lock exercise gave me a much deeper understanding of how CKB Scripts work.

I learned that a Lock Script is executable logic rather than simply a public key.

The Hash Lock example demonstrates the concept using a preimage:

```text
Correct preimage
       ↓
Hash verification
       ↓
Lock Script returns success
       ↓
Cell can be consumed
```

I also learned that script execution consumes CKB-VM cycles and that transaction validity depends on more than just the amount being transferred.

---

# 10. Week 1 Development Log

| Date           | Activity                                      | Result     |
| -------------- | --------------------------------------------- | ---------- |
| September 2026 | Installed OffCKB and prepared CKB environment | Completed  |
| September 2026 | Started local CKB Devnet                      | Completed  |
| September 2026 | Inspected Devnet accounts                     | Completed  |
| September 2026 | Practiced CKB transfer through OffCKB         | Completed  |
| September 2026 | Studied CKB Cell Model and transactions       | Completed  |
| September 2026 | Ran Store Data on Cell example                | Completed  |
| September 2026 | Created and transferred xUDT                  | Completed  |
| September 2026 | Created and inspected DOB / Spore             | Completed  |
| September 2026 | Built Hash Lock contract                      | Completed  |
| September 2026 | Deployed Hash Lock contract to Devnet         | Completed  |
| September 2026 | Ran Simple Lock frontend                      | Completed  |
| September 2026 | Deposited CKB into Hash Lock Cell             | Completed  |
| September 2026 | Tested Hash Lock reveal and transfer          | Completed  |
| September 2026 | Debugged CKB transaction and Lock Script      | Completed  |

---

# 11. Challenges

Several challenges appeared during Week 1.

### 11.1 Windows Build Compatibility

The Simple Lock build script attempted to execute esbuild using:

```text
./node_modules/.bin/esbuild
```

This caused an error on Windows.

I changed the execution method to:

```text
node node_modules/esbuild/bin/esbuild
```

This allowed the contract build to proceed.

### 11.2 pnpm Build Scripts

During dependency installation, pnpm reported packages whose build scripts were ignored.

This included packages such as:

```text
esbuild
secp256k1
sharp
unrs-resolver
```

This introduced an additional dependency-management issue that needed to be considered when running the example.

### 11.3 Devnet Deployment Artifacts

After restarting or recreating the Devnet, the previously generated deployment information could become invalid for the new Devnet state.

The frontend therefore needed to use the current deployment artifacts.

This taught me that deployment information is tied to the network state and should not blindly be reused after resetting the development environment.

### 11.4 PowerShell Command Differences

Some commands from Unix-based documentation did not work directly in Windows PowerShell.

For example, commands using Unix shell syntax needed to be adapted for PowerShell.

This was particularly important when working with environment variables and Node.js commands.

### 11.5 CKB Capacity

The most important conceptual challenge was understanding why a transaction could fail even when the account had enough CKB numerically.

The error:

```text
There is not enough capacity to create valid recipient and change cells and pay the transaction fee.
```

helped me understand that CKB capacity also represents storage requirements.

A transaction must have enough capacity to create valid Cells, not simply enough balance to cover the requested transfer amount.

### 11.6 Understanding Lock Script Execution

Using:

```powershell
offckb debug --tx-hash ...
```

allowed me to inspect Lock Script execution.

The result:

```text
Run result: 0
```

helped connect the conceptual explanation of scripts with their actual execution inside the CKB-VM.

---

# 12. Final Reflection

Week 1 gave me a practical introduction to the Nervos CKB ecosystem.

I started by setting up a local CKB development environment and learning how to work with OffCKB and Devnet accounts.

Through the beginner exercises, I gradually connected the theoretical concepts of CKB with actual transactions and applications.

The most important concept I learned was the Cell Model.

Instead of thinking of blockchain state only as account balances, I began to understand CKB as a system where:

```text
Cells
 ↓
Scripts
 ↓
Data
 ↓
Transactions
```

work together to represent blockchain state.

The Transfer CKB exercise helped me understand transaction inputs and outputs.

The Store Data exercise demonstrated how application data can be stored in Cells.

The xUDT exercise showed how tokens can be represented using Cells and scripts.

The DOB exercise demonstrated how on-chain content can be associated with Cell data and capacity.

Finally, the Simple Lock exercise introduced me to custom CKB Script development, deployment, script execution, and Hash Lock logic.

I also gained practical experience debugging environment and development problems, especially those related to Windows, pnpm, deployment artifacts, Devnet state, and transaction capacity.

The biggest lesson from Week 1 is that learning CKB requires understanding both the high-level concepts and what actually happens inside a transaction.

I am now more comfortable with the basic CKB architecture and ready to move toward application development and deeper CKB Script development.

---

# 13. Week 2 Goals

For Week 2, I plan to move from beginner exercises toward actual CKB application development.

My main goals are:

### 13.1 CCC

* Understand CCC (Common Chain Connector)
* Explore the CCC API
* Run CCC examples
* Experiment with transactions
* Understand how JavaScript / TypeScript applications communicate with CKB
* Build simple CKB application flows

### 13.2 CKB Scripts

I will continue learning how CKB Scripts work at a deeper level.

The main topics will include:

* Script structure
* Script arguments
* Lock Script
* Type Script
* Script execution
* CKB-VM
* CKB Debugger
* CKB-CLI

### 13.3 Rust

I will begin preparing a Rust environment for CKB Script development and explore basic CKB Rust examples.

### 13.4 Application Development

I want to move from simply running existing examples toward understanding how to build my own CKB application.

The main goal will be to understand the complete flow:

```text
Frontend
   ↓
CCC
   ↓
Transaction Construction
   ↓
CKB Node
   ↓
Cells
   ↓
Scripts
   ↓
State Transition
```

### Expected Outcome

By the end of Week 2, I aim to:

1. Understand the basic workflow of a CKB application.
2. Become comfortable with CCC fundamentals.
3. Understand how frontend applications interact with CKB.
4. Understand the execution model of CKB Scripts.
5. Start developing simple CKB Scripts.
6. Move from following tutorials toward building small CKB-based applications.
