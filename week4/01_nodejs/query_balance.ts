import { ccc } from "@ckb-ccc/ccc";

async function main() {
  const client = new ccc.ClientPublicTestnet({
    url: "http://127.0.0.1:8114",
  });

  // Cho phép truyền địa chỉ từ terminal.
  // Nếu không truyền, dùng ví ban đầu của mày.
  const address =
    process.argv[2] ??
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2prryvze6fhufxkgjx35psh7w70k3hz7c3mtl4d";

  const { script: lock } = await ccc.Address.fromString(
    address,
    client,
  );

  const balance = await client.getBalance([lock]);

  console.log("Network: OffCKB Devnet");
  console.log("Address:", address);
  console.log("Balance:", ccc.fixedPointToString(balance), "CKB");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});