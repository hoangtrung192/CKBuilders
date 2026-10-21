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

jest.setTimeout(120_000);

const CKB = 100_000_000n;
const VAULT_CAPACITY = 300n * CKB;
const FEE_CAPACITY = 100n * CKB;
const FEE = 100_000n;

// UTF-8 bytes of "week06-secret".
const SECRET = hexFrom(Buffer.from("week06-secret", "utf8"));

function createVerifier(scenario = "success"): Verifier {
  const resource = Resource.default();

  // Mock deployment of the always-success script.
  const alwaysSuccessCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
  );

  const recipientLock = resource.createScriptByData(
    alwaysSuccessCell,
    "0x",
  );

  // Same binary, different args => a different lock.
  const otherLock = resource.createScriptByData(
    alwaysSuccessCell,
    "0x01",
  );

  // Mock deployment of our compiled vault contract.
  const jsCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync("../on-chain-script/dist/index.bc")),
  );

  const jsScript = resource.createScriptByData(jsCell, "0x");

  // Mock deployment of the JS VM.
  const vmCell = resource.mockCell(
    resource.createScriptUnused(),
    undefined,
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
  );

  const loaderArgs =
    "0000" +
    jsScript.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(jsScript.hashType)).slice(2);

  const vaultData =
    hashCkb(SECRET).slice(2) +
    recipientLock.hash().slice(2);

  // Keep loader args valid; shorten only the vault data.
  const args = hexFrom(
    "0x" +
      loaderArgs +
      (scenario === "invalid args"
        ? vaultData.slice(0, -2)
        : vaultData),
  );

  const vaultLock = resource.createScriptByData(vmCell, args);

  // The contract is a LOCK script, not a type script.
  const vaultCell = resource.mockCell(
    vaultLock,
    undefined,
    "0x",
    VAULT_CAPACITY,
  );

  const feeCell = resource.mockCell(
    scenario === "wrong fee payer" ? otherLock : recipientLock,
    undefined,
    "0x",
    FEE_CAPACITY,
  );

  const inputs = [
    Resource.createCellInput(vaultCell),
    Resource.createCellInput(feeCell),
  ];

  if (scenario === "extra vault") {
    const extraVault = resource.mockCell(
      vaultLock,
      undefined,
      "0x",
      VAULT_CAPACITY,
    );

    inputs.push(Resource.createCellInput(extraVault));
  }

  let suppliedSecret = SECRET;

  if (scenario === "wrong secret") {
    suppliedSecret = hexFrom(Buffer.from("wrong-secret", "utf8"));
  }

  if (scenario === "empty secret") {
    suppliedSecret = "0x";
  }

  let vaultWitness = hexFrom(
    WitnessArgs.from({ lock: suppliedSecret }).toBytes(),
  );

  if (scenario === "missing lock field") {
    vaultWitness = hexFrom(WitnessArgs.from({}).toBytes());
  }

  if (scenario === "malformed witness") {
    vaultWitness = "0x1234";
  }

  const witnesses = inputs.map((_, index) =>
    index === 0 ? vaultWitness : hexFrom("0x"),
  );

  if (scenario === "vault not first") {
    [inputs[0], inputs[1]] = [inputs[1], inputs[0]];
    [witnesses[0], witnesses[1]] = [
      witnesses[1],
      witnesses[0],
    ];
  }

  let paymentCapacity = VAULT_CAPACITY;

  if (scenario === "underpayment") {
    paymentCapacity -= 1n;
  }

  // Send the unpaid shannon to change in the underpayment test.
  const changeCapacity =
    VAULT_CAPACITY + FEE_CAPACITY - paymentCapacity - FEE;

  const outputs = [
    Resource.createCellOutput(
      scenario === "wrong recipient" ? otherLock : recipientLock,
      undefined,
      paymentCapacity,
    ),
    Resource.createCellOutput(
      recipientLock,
      undefined,
      changeCapacity,
    ),
  ];

  const outputsData = [hexFrom("0x"), hexFrom("0x")];

  if (scenario === "missing output") {
    outputs.length = 0;
    outputsData.length = 0;
  }

  const tx = Transaction.from({
    cellDeps: [
      Resource.createCellDep(alwaysSuccessCell, "code"),
      Resource.createCellDep(jsCell, "code"),
      Resource.createCellDep(vmCell, "code"),
    ],
    inputs,
    outputs,
    outputsData,
    witnesses,
  });

  return Verifier.from(resource, tx);
}

describe("Secret Vault", () => {
  test("correct secret, recipient and payment succeed", async () => {
    await createVerifier().verifySuccess(true);
  });

  test.each([
    ["invalid args", 10],
    ["empty secret", 11],
    ["missing lock field", 11],
    ["malformed witness", 11],
    ["wrong secret", 12],
    ["wrong recipient", 13],
    ["missing output", 13],
    ["wrong fee payer", 14],
    ["vault not first", 14],
    ["extra vault", 14],
    ["underpayment", 15],
  ] as const)("%s fails with code %i", async (scenario, code) => {
    await createVerifier(scenario).verifyFailure(code, true);
  });
});