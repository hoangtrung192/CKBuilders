# CKBuilder Week 09 — Script Group Execution and WitnessArgs

**Owner:** Daniel Do  
**Objective:** Read and run the official `group_exec` example, then explain group indexing and witness access. No contract logic changes, Devnet deployment, frontend, or real transaction.

## Source and environment

- Official source: [`nervosnetwork/docs.nervos.org`](https://github.com/nervosnetwork/docs.nervos.org), `develop` commit `6829c711c7314c3c974cacbfee3e83f9ee563f1c`. The untouched example is copied to [`week09/group-exec-example`](../week09/group-exec-example/). The existing root `ckb-rust-script` project and previous weeks were left intact.
- Read: [contract main](../week09/group-exec-example/contracts/group_exec/src/main.rs), [contract manifest](../week09/group-exec-example/contracts/group_exec/Cargo.toml), [contract Makefile](../week09/group-exec-example/contracts/group_exec/Makefile), [complete test source](../week09/group-exec-example/tests/src/tests.rs), [test loader](../week09/group-exec-example/tests/src/lib.rs), [test manifest](../week09/group-exec-example/tests/Cargo.toml), [workspace manifest](../week09/group-exec-example/Cargo.toml), [lockfile](../week09/group-exec-example/Cargo.lock), and [toolchain pin](../week09/group-exec-example/rust-toolchain).
- Windows 11, PowerShell, native Rust `1.95.0` MSVC (selected automatically by the source's `rust-toolchain`) and target `riscv64imac-unknown-none-elf`. The source Makefile supplies `-C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic -C debug-assertions`. Docker is unavailable; WSL 2 has no installed distribution. Make is installed, but its Bash route cannot run without a WSL distribution. The build therefore used native Cargo with the equivalent Rust flags.
- The host test compiled and ran natively on Windows. CKB's `ckb-std` also compiles a small C library for RISC-V. The official LLVM 19 Windows Clang lacked a RISC-V backend, so the successful build used Zig 0.13.0's Clang 18.1.6 through a local `clang.cmd`/Python argument adapter. It mapped the source's `--target=riscv64` to Zig's `--target=riscv64-freestanding-none` and the C `-march=rv64imc_zba_zbb_zbc_zbs` argument to `-mcpu=baseline_rv64-f-d` for the required soft-float ABI. LLVM 19 `llvm-ar` and `llvm-objcopy` were used from `.week09-tools`; no repo dependency, Rust version, or lockfile was altered.

## Transaction and groups

The test deploys one binary and builds three scripts with distinct UTF-8 `args`: Lock L (`lock 1`), Type A (`type 1`), and Type B (`type 2`). Script identity includes `code_hash`, `hash_type`, and `args`; therefore the same binary can form different groups. Lock and Type groups are evaluated separately.

| Global index | Input cell | Output cell |
| --- | --- | --- |
| 0 | Lock L, Type A | Lock L, Type B |
| 1 | Lock L, Type B | Lock L, Type A |

`Input` and `Output` indexes address the whole transaction. `GroupInput` and `GroupOutput` indexes start at zero within the current script group. The contract prints global lock/type cell indexes and then iterates group witnesses.

| Group | GroupInput[0] | GroupInput[1] | GroupOutput[0] |
| --- | --- | --- | --- |
| Lock L | input[0] → witness[0] | input[1] → witness[1] | — |
| Type A | input[0] → witness[0] | — | output[1] → witness[1] |
| Type B | input[1] → witness[1] | — | output[0] → witness[0] |

The test constructs `witness_0` and `witness_1` with `WitnessArgs::new_builder()`. Each has `lock`, `input_type`, and `output_type`, all set to `Some(Bytes)` with distinct labels. It serializes each with `.build().as_bytes()` and attaches them in global order using `.witnesses([witness_0.pack(), witness_1.pack()])` before `context.complete_tx(tx)` and `verify_tx`.

`WitnessArgs` is a data convention with three optional fields. The VM does not require every script to use it or restrict a script to reading only one field. This example's contract prints **only `lock`** when executing as a lock group, and **both `input_type` and `output_type`** when executing as a type group. The usual assignment of lock data to `lock` and type data to `input_type`/`output_type` is a convention; it is distinct from the exact fields printed here.

## Build and focused test

The loader uses `MODE=release` by default and finds `build/release/group_exec` through `TOP` or its relative fallback. `MODE=debug` selects `build/debug`. The focused test is `tests::test_group_exec` in package `tests`.

From `G:\neon\week09\group-exec-example`, these commands were run after installing the pinned toolchain and target:

```powershell
rustup toolchain install 1.95.0 --profile minimal --target riscv64imac-unknown-none-elf
cargo test --locked -p tests --lib --no-run
$env:CLANG='G:\neon\.week09-tools\clang.cmd'
$env:TARGET_CC=$env:CLANG
$env:TARGET_AR='G:\neon\.week09-tools\llvm\bin\llvm-ar.exe'
$env:TARGET_CFLAGS='-mcpu=baseline_rv64-f-d'
$env:RUSTFLAGS='-C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic -C debug-assertions'
cargo build --locked --release -p group_exec --target riscv64imac-unknown-none-elf
New-Item -ItemType Directory -Force build/release
Copy-Item target/riscv64imac-unknown-none-elf/release/group_exec build/release/group_exec
Copy-Item build/release/group_exec build/release/group_exec.debug
& 'G:\neon\.week09-tools\llvm\bin\llvm-objcopy.exe' --strip-debug --strip-all build/release/group_exec
$env:MODE='release'
$env:TOP='G:\neon\week09\group-exec-example'
cmd.exe /d /s /c 'cargo test --locked -p tests --lib tests::test_group_exec -- --exact --nocapture 2>&1' | Tee-Object -FilePath 'G:\neon\evidence\week-09\test_group_exec.log'
$LASTEXITCODE
```

The adapter and compiler downloads are local build tools under `.week09-tools`; they are not contract source. The initial native build attempts exposed, in order, missing Clang, the official Windows LLVM build's absent RISC-V backend, Zig's target spelling, Zig's CPU option spelling, and a hard-float C object. All were environment/tool invocation errors and were resolved without editing the example. The successful contract build exited `0`. The stripped loader binary is **51,832 bytes**, with its unstripped `.debug` copy retained; both are under the isolated Week 09 project.

The final focused test exited **0** and printed `running 1 test`, `test tests::test_group_exec ... ok`, and `test result: ok. 1 passed; 0 failed` (22 other tests filtered out). Its contract log shows Lock L at global inputs `[00, 01]`, Type A at input `[00]`/output `[01]`, and Type B at input `[01]`/output `[00]`, with the witness strings matching the table above. It consumed `226912` cycles. See the [raw combined stdout/stderr test log](../evidence/week-09/test_group_exec.log). The PowerShell pipeline used `cmd.exe` to merge native streams before `Tee-Object`, and `$LASTEXITCODE` was checked immediately afterward.

The exercise demonstrates that script grouping is based on the full script and script kind, while group indexes are local views over globally ordered cells and witnesses. Both type witness fields appear in the example's logs for each type group; the code does not restrict itself to the conventional field for the direction being examined.

## Evidence

See [evidence index](../evidence/week-09/README.md). Two real screenshots have been inspected: [01_Contract_tested.png](../week09/evidence/01_Contract_tested.png) shows the focused terminal command, group/index/witness output, and `1 passed; 0 failed`; [02_Witness_Transactions.png](../week09/evidence/02_Witness_Transactions.png) shows the `witness_1` `WitnessArgs` builder, fields from `witness_0`, and the `.witnesses(...)` call. The source screenshot starts at line 502 and omits the first two lines of the `witness_0` builder; the complete code is in [tests.rs](../week09/group-exec-example/tests/src/tests.rs). The two image files use the owner's actual filenames in `week09/evidence/`.
