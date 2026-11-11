# CKB Week 09 — Script Group Execution and WitnessArgs

**Owner:** Daniel Do

This is my Week 09 study of the official CKB `group_exec` contract and its `test_group_exec` test. I used the example from [`nervosnetwork/docs.nervos.org` at commit `6829c711`](https://github.com/nervosnetwork/docs.nervos.org/commit/6829c711c7314c3c974cacbfee3e83f9ee563f1c). The copied [example project](group-exec-example/) is kept separate from my earlier work. I did not change the contract logic or deploy anything to Devnet.

## What I learned

CKB groups cells by the complete Script (`code_hash`, `hash_type`, and `args`). Lock groups and Type groups are separate. In this test, the same `group_exec` binary is used for one Lock Script (`lock 1`) and two Type Scripts (`type 1`, `type 2`). Their different `args` make them distinct groups.

The test transaction has this layout:

| Transaction index | Input | Output |
| --- | --- | --- |
| 0 | Lock L, Type A | Lock L, Type B |
| 1 | Lock L, Type B | Lock L, Type A |

`Input` and `Output` use indexes across the whole transaction. `GroupInput` and `GroupOutput` start at zero within the current group. Group indexes still lead to witnesses associated with the corresponding transaction input or output index:

| Group | GroupInput | GroupOutput |
| --- | --- | --- |
| Lock L | `[0] → witness[0]`, `[1] → witness[1]` | — |
| Type A | `[0] → witness[0]` from input[0] | `[0] → witness[1]` from output[1] |
| Type B | `[0] → witness[1]` from input[1] | `[0] → witness[0]` from output[0] |

Multiple groups can read the same witness because they refer to cells at the same transaction index. The test builds two serialized `WitnessArgs` values and attaches them with `.witnesses([witness_0.pack(), witness_1.pack()])` in [tests.rs](group-exec-example/tests/src/tests.rs#L500-L540). `WitnessArgs` has three optional fields: `lock`, `input_type`, and `output_type`. It is a data convention, not a VM rule requiring every script to use this format or only one field. This particular [contract](group-exec-example/contracts/group_exec/src/main.rs#L99-L124) prints `lock` in its Lock group and both `input_type` and `output_type` in its Type groups.

## Build and test result

I built `group_exec` for `riscv64imac-unknown-none-elf` with the example's pinned Rust 1.95.0 toolchain and debug assertions enabled. The test loader reads `build/release/group_exec` when `MODE=release`. On this Windows machine, the build used a local Zig Clang adapter for the RISC-V C dependency; the exact commands and environment are in the [Week 09 report](../reports/week-09.md).

I ran only `tests::test_group_exec` with `--exact --nocapture`. The result was **1 passed, 0 failed**, exit code **0**, with `226912` cycles. The [test log](../evidence/week-09/test_group_exec.log) contains the group, index, and witness output.

## My evidence

- [Contract test screenshot](evidence/01_Contract_tested.png): the terminal shows the focused command, debug output, and `1 passed; 0 failed`.
- [WitnessArgs transaction screenshot](evidence/02_Witness_Transactions.png): the source shows a `WitnessArgs` builder and the `.witnesses(...)` call that attaches both witnesses.
- [Full evidence index](../evidence/week-09/README.md) and [Week 09 report](../reports/week-09.md).
## Recommendations for Week 10

For Week 10, I plan to apply Script Group Execution to the handbook’s [sUDT example](https://github.com/nervosnetwork/docs.nervos.org/tree/6829c711c7314c3c974cacbfee3e83f9ee563f1c/examples/ckb-rust-script/contracts/sudt). This moves from observing groups and witnesses to validating token amounts within each Type Script group.

My proposed tasks are:

- **Understand token data:** read how the contract decodes token amounts as little-endian `u128` values and collects amounts through `GroupInput` and `GroupOutput`.
- **Run the existing tests:** reproduce `test_transfer_sudt`, `test_owner_mode_sudt`, and `test_overissue_sudt`, explaining why each transaction is accepted or rejected.
- **Extend test coverage:** add cases for burning tokens, amount data shorter than 16 bytes, and two different token groups. Confirm that a surplus in one token group cannot compensate for unauthorized issuance in another.
- **Document the results:** record the transaction layouts, expected outcomes, actual test results, and screenshots using the existing Rust environment.

The proposed scope is local contract testing and documentation. Devnet deployment and a frontend can be considered in a later week.