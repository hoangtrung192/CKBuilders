import * as ccc from "@ckb-ccc/core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createDevnetClient } from "./devnet-client.ts";

const RPC_URL = "http://127.0.0.1:8114";
const SECRET = "week06-secret";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error: ${response.status}`);
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(JSON.stringify(body.error));
  }

  return body.result;
}

async function main() {
  const state = readJson("vault.json");
  const client = createDevnetClient();

  // If already submitted, wait for the existing transaction.
  if (existsSync("unlock.json")) {
    const previous = readJson("unlock.json");

    if (previous.createTxHash !== state.txHash) {
      throw new Error("unlock.json belongs to another vault.");
    }

    console.log("Existing unlock tx:", previous.txHash);
    await client.waitTransaction(previous.txHash);
    console.log("Vault unlock confirmed.");
    return;
  }

  const outPoint = {
    tx_hash: state.txHash,
    index: `0x${Number(state.outputIndex).toString(16)}`,
  };

  const live = await rpc("get_live_cell", [outPoint, false]);

  if (live.status !== "live") {
    throw new Error(`Vault is not live: ${live.status}`);
  }

  const output = live.cell.output;

  const liveLock = ccc.Script.from({
    codeHash: output.lock.code_hash,
    hashType: output.lock.hash_type,
    args: output.lock.args,
  });

  if (liveLock.hash() !== ccc.Script.from(state.vaultLock).hash()) {
    throw new Error("Live vault lock differs from vault.json.");
  }

  if (output.type !== null) {
    throw new Error("This exercise only unlocks plain CKB vaults.");
  }

  const keyText = readFileSync("a.key", "utf8").trim();
  const key = keyText.startsWith("0x")
    ? keyText
    : `0x${keyText}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Invalid private key format in a.key.");
  }

  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const recipient = await signer.getRecommendedAddressObj();

  const args = ccc.bytesFrom(liveLock.args);

  if (args.length !== 99) {
    throw new Error("Invalid vault args length.");
  }

  const expectedSecretHash = ccc.hexFrom(args.slice(35, 67));
  const expectedRecipientHash = ccc.hexFrom(args.slice(67, 99));
  const secretBytes = ccc.hexFrom(Buffer.from(SECRET, "utf8"));

  if (ccc.hashCkb(secretBytes) !== expectedSecretHash) {
    throw new Error("Secret does not match this vault.");
  }

  if (recipient.script.hash() !== expectedRecipientHash) {
    throw new Error("a.key does not belong to the vault recipient.");
  }

  const capacity = BigInt(output.capacity);
  const vaultCode = readJson("deployment/scripts.json")
    .devnet["index.bc"];
  const jsVm = readJson("deployment-js-vm/scripts.json")
    .devnet["ckb-js-vm"];

  const tx = ccc.Transaction.from({
    cellDeps: [
      ...jsVm.cellDeps.map((entry: any) => entry.cellDep),
      ...vaultCode.cellDeps.map((entry: any) => entry.cellDep),
    ],
    inputs: [{
      previousOutput: {
        txHash: state.txHash,
        index: Number(state.outputIndex),
      },
    }],
    outputs: [{
      capacity,
      lock: recipient.script,
    }],
    outputsData: ["0x"],
    witnesses: [
      ccc.hexFrom(
        ccc.WitnessArgs.from({ lock: secretBytes }).toBytes(),
      ),
    ],
  });

  // Collect separate recipient-owned capacity for fee and change.
  await tx.completeInputsByCapacity(
    signer,
    100n * 100_000_000n,
  );

  // Higher fee rate for this JS VM exercise.
  await tx.completeFeeBy(signer, 100_000);

  if (tx.outputs[0].capacity < capacity) {
    throw new Error("Output 0 does not return the full vault capacity.");
  }

  if (tx.outputs[0].lock.hash() !== expectedRecipientHash) {
    throw new Error("Output 0 has the wrong recipient.");
  }

  console.log("Network:", RPC_URL);
  console.log("Recipient:", recipient.toString());
  console.log("Returned capacity:", ccc.fixedPointToString(capacity), "CKB");
  console.log("Inputs:", tx.inputs.length);

  const txHash = await signer.sendTransaction(tx);

  writeFileSync(
    "unlock.json",
    JSON.stringify({
      createTxHash: state.txHash,
      txHash,
      recipientAddress: recipient.toString(),
      capacity: capacity.toString(),
    }, null, 2) + "\n",
  );

  console.log("Unlock tx:", txHash);
  console.log("Saved: unlock.json");
  console.log("Waiting for confirmation...");

  await client.waitTransaction(txHash);

  console.log("Vault unlock confirmed.");

  const after = await rpc("get_live_cell", [outPoint, false]);
  console.log("Original vault cell status:", after.status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
