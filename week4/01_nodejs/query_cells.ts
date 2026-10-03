import { ccc } from "@ckb-ccc/ccc";

async function main() {
  const client = new ccc.ClientPublicTestnet({
    url: "http://127.0.0.1:8114",
  });

  const address =
    process.argv[2] ??
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2prryvze6fhufxkgjx35psh7w70k3hz7c3mtl4d";

  const { script: lock } = await ccc.Address.fromString(
    address,
    client,
  );

  let count = 0;
  let totalCapacity = 0n;

  console.log("Address:", address);

  for await (const cell of client.findCellsByLock(
    lock,
    undefined,
    true,
  )) {
    count++;
    totalCapacity += cell.cellOutput.capacity;

    console.log(`\nCell #${count}`);
    console.log("Tx hash:", cell.outPoint.txHash);
    console.log("Index:", cell.outPoint.index.toString());
    console.log(
      "Capacity:",
      ccc.fixedPointToString(cell.cellOutput.capacity),
      "CKB",
    );
    console.log("Lock args:", cell.cellOutput.lock.args);

    const type = cell.cellOutput.type;

    if (type) {
      console.log("Type code hash:", type.codeHash);
      console.log("Type hash type:", type.hashType);
      console.log("Type args:", type.args);
    } else {
      console.log("Type: none");
    }

    console.log("Data:", cell.outputData);
  }

  console.log("\nTotal live Cells:", count);
  console.log(
    "Total capacity:",
    ccc.fixedPointToString(totalCapacity),
    "CKB",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});