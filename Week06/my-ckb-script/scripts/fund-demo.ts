import * as ccc from "@ckb-ccc/core";
import { readFileSync } from "node:fs";
import { createDevnetClient } from "./devnet-client.ts";

async function main() {
  const client = createDevnetClient();

  const raw = readFileSync("a.key", "utf8").trim();
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Invalid private key format in a.key.");
  }

  const sender = new ccc.SignerCkbPrivateKey(client, key);
  const demo = new ccc.SignerCkbPrivateKey(
    client,
    `0x${"11".repeat(32)}`,
  );

  const recipient = await demo.getRecommendedAddressObj();
  const amount = 1_000n * 100_000_000n;
  const balance = await demo.getBalance();

  console.log("Demo address:", recipient.toString());
  console.log("Current balance:", ccc.fixedPointToString(balance), "CKB");

  if (balance >= amount) {
    console.log("Demo wallet already has enough CKB.");
    return;
  }

  const tx = ccc.Transaction.from({
    outputs: [{ capacity: amount, lock: recipient.script }],
    outputsData: ["0x"],
  });

  await tx.completeInputsByCapacity(sender);
  await tx.completeFeeBy(sender, 1000);

  const txHash = await sender.sendTransaction(tx);
  console.log("Funding tx:", txHash);

  await client.waitTransaction(txHash);
  console.log("Demo funding confirmed.");
  console.log(
    "Demo balance:",
    ccc.fixedPointToString(await demo.getBalance()),
    "CKB",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
