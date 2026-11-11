# Week 09 evidence

- [Test log](test_group_exec.log): direct stdout and stderr from the focused Rust host test. The test command's exit code is recorded in the weekly report.
- [01_Contract_tested.png](../../week09/evidence/01_Contract_tested.png): real PowerShell capture with the focused test command, group/index/witness debug output, and `1 passed; 0 failed`.
- [02_Witness_Transactions.png](../../week09/evidence/02_Witness_Transactions.png): real source capture showing the `witness_1` `WitnessArgs::new_builder()` block, fields from `witness_0`, and `.witnesses([witness_0.pack(), witness_1.pack()])`.
- [Independent reviewer log](reviewer-test-20261111.log): a separate run using a freshly built binary.

Both PNG files were opened and inspected on 2026-11-12. The source screenshot begins at line 502, so the first two lines of the `witness_0` builder are outside its frame; the [source file](../../week09/group-exec-example/tests/src/tests.rs) shows the complete block at lines 500–515.
