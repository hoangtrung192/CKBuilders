import {
  hashCkb,
  hashTypeToBytes,
  hexFrom,
  Transaction,
  WitnessArgs,
} from "@ckb-ccc/core";
import { readFileSync } from "fs";
import {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  DEFAULT_SCRIPT_CKB_JS_VM,
} from "ckb-testtool";

// Hex của chuỗi "hello-ckb".
const SECRET = "0x68656c6c6f2d636b62";
const WRONG_SECRET = "0x77726f6e67";

function createVerifier(secret?: string): Verifier {
  const resource = Resource.default();

  const alwaysSuccessCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
  );

  const alwaysSuccessScript = resource.createScriptByData(
    alwaysSuccessCell,
    "0x",
  );

  const jsCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync("../on-chain-script/dist/index.bc")),
  );

  const jsScript = resource.createScriptByData(jsCell, "0x");

  const vmCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
  );

  // Loader: 2 byte + code hash: 32 byte + hash type: 1 byte.
  // Sau đó nối hash của secret: 32 byte.
  const loaderArgs =
    "0x0000" +
    jsScript.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(jsScript.hashType)).slice(2);

  const hashLockScript = resource.createScriptByData(
    vmCell,
    hexFrom(loaderArgs + hashCkb(SECRET).slice(2)),
  );

  // Contract của mình nằm ở LOCK của input cell.
  const inputCell = resource.mockCell(hashLockScript);

  const witness = WitnessArgs.from(
    secret === undefined ? {} : { lock: hexFrom(secret) },
  );

  const tx = Transaction.from({
    cellDeps: [
      Resource.createCellDep(alwaysSuccessCell, "code"),
      Resource.createCellDep(jsCell, "code"),
      Resource.createCellDep(vmCell, "code"),
    ],
    inputs: [Resource.createCellInput(inputCell)],
    outputs: [
      Resource.createCellOutput(alwaysSuccessScript),
    ],
    outputsData: ["0x"],
    witnesses: [hexFrom(witness.toBytes())],
  });

  return Verifier.from(resource, tx);
}

describe("Hash-lock", () => {
  test("correct secret -> unlock succeeds", async () => {
    const verifier = createVerifier(SECRET);
    await verifier.verifySuccess(true);
  });

  test("wrong secret -> rejected with code 3", async () => {
    const verifier = createVerifier(WRONG_SECRET);
    await verifier.verifyFailure(3, true);
  });

  test("missing secret -> rejected with code 2", async () => {
    const verifier = createVerifier();
    await verifier.verifyFailure(2, true);
  });
});