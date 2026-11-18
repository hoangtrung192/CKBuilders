# CKB Week 10 — sUDT Validation: Transfer, Owner Mode, Burn and Token Group Isolation

**Owner:** Daniel Do

## Objective and source

Build the tutorial sUDT Type Script for CKB RISC-V and execute it through `ckb-testtool`. Test transfers, issuer owner mode, burns, malformed amount data, and independent validation of two token groups. A subsequent Testnet exercise deployed the same binary and performed mint, transfer, and burn transactions.

`sudt-example/` is an isolated copy of the tracked files in `week09/group-exec-example/`, sourced from [`nervosnetwork/docs.nervos.org` commit `6829c711c7314c3c974cacbfee3e83f9ee563f1c`](https://github.com/nervosnetwork/docs.nervos.org/commit/6829c711c7314c3c974cacbfee3e83f9ee563f1c). The [contract](sudt-example/contracts/sudt/src/main.rs), dependency versions, `Cargo.lock`, and `rust-toolchain` are unchanged. The first three tests in [test_sudt.rs](sudt-example/tests/src/test_sudt.rs) are the unchanged upstream baseline; five tests and small transaction helpers were added below them. The original workspace layout was retained. `target/` and `build/` are ignored build output.

## Token cell and validation flow

The first 16 bytes of a token cell's data encode its amount as a little-endian `u128`. The Type Script's 32-byte args contain the issuer's owner Lock Script hash and distinguish one token group from another. Token amount is separate from CKB capacity: the added tests use 20,000,000,000 shannons of capacity per output, while values such as `100` and `400` are token amounts stored in cell data.

The contract checks input lock hashes across the **whole transaction**. If one matches its args, issuer **owner mode** accepts the transaction and permits issuance. This differs from a holder's ordinary ownership of a cell through its Lock Script. Without an owner match, normal mode sums amounts from `GroupInput` and `GroupOutput` and requires `output total <= input total` for that Type Script group. Different args create separate groups even when the code binary is identical.

Local tests use `ALWAYS_SUCCESS` as a lock fixture; it does not verify wallet signatures. The Testnet transactions used signed lock scripts.

## Local contract tests

The compiled RISC-V contract was loaded from `build/release/sudt` and executed by `ckb-testtool`. The original baseline run had **3 passed, 0 failed**. The final focused run had **8 passed, 0 failed**, exit code `0`; formatting also exited `0`. The [test screenshot](Evidence/06_TestContract.png) shows the eight passing cases and expected group B rejection.

| Scenario | Token input → output | Issuer owner mode | Expected | Actual |
| --- | --- | --- | --- | --- |
| Upstream transfer | 400 → 300 + 100 | Absent | Accepted | Accepted |
| Upstream owner mode | 400 → 300 + 500 | Present | Accepted | Accepted |
| Upstream overissue | 400 → 300 + 500 | Absent | `InvalidAmount` (13) | Rejected with code 13; test passed |
| Burn | 400 → 300 | Absent | Accepted | Accepted |
| Short input data | 15-byte input → 0 | Absent | `AmountEncoding` (12) | Rejected with code 12; test passed |
| Short output data | 100 → 15-byte output | Absent | `AmountEncoding` (12) | Rejected with code 12; test passed |
| Two valid groups | A: 100 → 100; B: 200 → 200 | Absent in both | Accepted | Accepted |
| Isolated overissue | A: 100 → 90; B: 100 → 110 | Absent in both | `InvalidAmount` (13) in B | Rejected with code 13 at `Inputs[1].Type`; test passed |

The two-group transactions use one sUDT binary as a dependency and two Type Scripts with different 32-byte args. The args do not equal any input lock hash.

| Global index | Input Type Script | Output Type Script | Valid case | Isolated overissue case |
| --- | --- | --- | --- | --- |
| 0 | Group A | Group A | 100 → 100 | 100 → 90 |
| 1 | Group B | Group B | 200 → 200 | 100 → 110 |

The isolated overissue transaction has 200 tokens on both sides globally. It still fails because Group B has `110 > 100`. The assertion checks error code 13 and `Inputs[1].Type`. Successful local cases reported 28,778 cycles for upstream transfer, 45,158 for owner mode, 61,198 for burn, and 122,287 for two valid groups in the final run. Rejection assertions do not expose a successful cycle count.

## Testnet transactions

The stripped 45,576-byte `sudt` binary was deployed on CKB Testnet. Its `data2` code hash is `0x46c359378f1bdd69c54d17b05dc22bf0cca43166993ef26823bee53b8313d907`; the code cell is output `0` of the deployment transaction. The token Type Script uses that code hash and owner args `0xa59f2c341535cc85d7dfeebd19899c9ca3a0d1461980c82a6782f287c2102bfe`. Its Type Script hash is `0x7afb2f4facf9687cf743f3ed94eaf7ddf92b4116e2b950d46fdd5acb3eabb389`.

| Action | Transaction | Observed result | Screenshot |
| --- | --- | --- | --- |
| Deploy code | [0x44bb…b09b](https://testnet.explorer.nervos.org/transaction/0x44bb8008c86c6a9becf5b8c0c58b7a6bae24d4d94fe06f4236d3e7ac3e37b09b) | Committed; code output live, 45,576 data bytes | — |
| Mint 400 | [0x750f…b9a4c](https://testnet.explorer.nervos.org/transaction/0x750fcd3bc92e1925e31388115318090eaa48b767db60bd4298ea9cc9e96b9a4c) | Committed; 400-token output, 200 CKB capacity | [Mint](Evidence/02_Mint400.png) |
| Distribute 400 | [0xce53…44042](https://testnet.explorer.nervos.org/transaction/0xce5317cb805f674ded205e95ee564a70db62f20651d22cdbd266d4e1e0c44042) | Committed; holder received 300 + 100 token cells | [Distribution](Evidence/03_Token_distribution.png) |
| Normal transfer | [0x674d…09293](https://testnet.explorer.nervos.org/transaction/0x674d37903ba2da9b64d57b4f96ac4aefe3843c5b20f8e76151361b6ee7509293) | Committed; holder 300 → 250 + 50 | [Transfer](Evidence/04_Transfer.png) |
| Burn 10 | [0x144f…f0033](https://testnet.explorer.nervos.org/transaction/0x144fcb7048de82f6a661111d011f3cbc7e5348a762ae11c8f0512c8871ff0033) | Committed; holder 100 → 90 | [Burn](Evidence/05_BurnToken.png) |

Mint and distribution used an issuer input, so owner mode was present. Transfer and burn were signed by a separate holder account whose input lock hash differed from the owner args; they exercised normal mode. A final RPC `get_live_cell` check found the **250, 50, and 90** token outputs live, for **390 sUDT** remaining. The mint output was spent in distribution, and the 100-token distribution output was spent in the burn. Testnet keys and deployment metadata are held outside this repository; no secret is included here. Preserve the holder key securely to access the remaining tokens.

The Testnet RPC `estimate_cycles` results were 1,696,393 for mint, 1,692,837 for distribution, 1,709,112 for transfer, and 1,714,262 for burn. The linked explorer screenshots display those figures as well. These are distinct from local `ckb-testtool` cycle counts.

## Reproduce on Windows

The verified host was Windows 11 (`Microsoft Windows 10.0.26200`) with PowerShell, Rust/Cargo 1.95.0 MSVC, target `riscv64imac-unknown-none-elf`, Zig 0.13.0, and LLVM tools under `.week09-tools/`. The local Week 09 Zig/Clang adapter is required for the RISC-V C dependency in this setup; [Week 09's report](../reports/week-09.md) explains its target and CPU flag adaptation. The source Makefile uses Bash, so this run used PowerShell and native Cargo with equivalent Rust flags. `rustfmt` was added to the pinned toolchain without upgrading it.

Run from the repository root after preparing the Week 09 adapter and tools:

```powershell
$root = (Get-Location).Path
Set-Location (Join-Path $root 'week10/sudt-example')
$env:CLANG = Join-Path $root '.week09-tools/clang.cmd'
$env:TARGET_CC = $env:CLANG
$env:TARGET_AR = Join-Path $root '.week09-tools/llvm/bin/llvm-ar.exe'
$env:TARGET_CFLAGS = '-mcpu=baseline_rv64-f-d'
$env:RUSTFLAGS = '-C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic -C debug-assertions'
cargo build --locked --release -p sudt --target riscv64imac-unknown-none-elf
$LASTEXITCODE
New-Item -ItemType Directory -Force build/release | Out-Null
Copy-Item target/riscv64imac-unknown-none-elf/release/sudt build/release/sudt
Copy-Item build/release/sudt build/release/sudt.debug
& (Join-Path $root '.week09-tools/llvm/bin/llvm-objcopy.exe') --strip-debug --strip-all build/release/sudt
$LASTEXITCODE
Remove-Item Env:RUSTFLAGS
$env:MODE = 'release'
$env:TOP = (Get-Location).Path
cargo test --locked -p tests --lib test_sudt:: -- --nocapture
$LASTEXITCODE
cargo fmt --all -- --check
$LASTEXITCODE
```

The contract build, strip, test, and format commands each exited `0` in the completed run. `build/release/sudt` is the loader path; `sudt.debug` is an unstripped build artifact. These commands only build and test locally; they do not submit transactions.

## Problems and limits

The first compile of the added tests found two Rust borrow conflicts in helpers. Storing `context.complete_tx(tx)` before `verify_tx` resolved them. `rustfmt` initially was absent from the pinned toolchain; installing that component and formatting the added tests resolved the formatting check. No contract logic or dependency was changed.

The eight cases demonstrate VM execution locally. Testnet mint, transfer, and burn were also committed, while malformed data and two-group isolation were tested locally only. The tutorial decoder checks that data has at least 16 bytes but copies the entire slice into a 16-byte buffer; data longer than 16 bytes may trap instead of returning a dedicated amount-encoding error. The contract also uses a simple `u128` sum. Production hardening is separate work.

Next steps are to add any personal learning notes and securely back up the Testnet holder key.
