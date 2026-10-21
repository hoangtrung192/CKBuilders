import * as ccc from "@ckb-ccc/core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RPC_URL = "http://127.0.0.1:8114";
const CAPACITY = 300n * 100_000_000n;
const SECRET = "week06-secret";

function loadDeployment(path: string, name: string) {
  const config = JSON.parse(readFileSync(path, "utf8"));
  const script = config.devnet?.[name];

  if (!script) {
    throw new Error(`Missing deployment: ${name} in ${path}`);
  }

  return script;
}

async function main() {
  if (existsSync("vault.json")) {
    throw new Error(
      "vault.json already exists. Check the previous vault before creating another.",
    );
  }

  const vaultCode = loadDeployment(
    "deployment/scripts.json",
    "index.bc",
  );
  const jsVm = loadDeployment(
    "deployment-js-vm/scripts.json",
    "ckb-js-vm",
  );

  const secpDepTx =
    "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293";

  const systemDepTx =
    "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7";

  function systemScript(
    codeHash: string,
    txHash: string,
    index: number,
    depType: "code" | "depGroup" = "code",
  ) {
    return {
      codeHash,
      hashType: "type" as const,
      cellDeps: [{
        cellDep: {
          outPoint: { txHash, index },
          depType,
        },
      }],
    };
  }

  const secp = systemScript(
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    secpDepTx, 0, "depGroup",
  );

  const omni = systemScript(
    "0x9c6933d977360f115a3e9cd5a2e0e475853681b80d775d93ad0f8969da343e56",
    systemDepTx, 7,
  );

  const scripts = {
    Secp256k1Blake160: secp,
    Secp256k1Multisig: systemScript(
      "0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
      secpDepTx, 1, "depGroup",
    ),
    AnyoneCanPay: systemScript(
      "0xe09352af0066f3162287763ce4ddba9af6bfaeab198dc7ab37f8c71c9e68bb5b",
      systemDepTx, 8,
    ),
    OmniLock: {
      ...omni,
      cellDeps: [...omni.cellDeps, ...secp.cellDeps],
    },
    XUdt: systemScript(
      "0x1a1e4fef34f5982906f745b048fe7b1089647e82346074e0f32c2ece26cf6b1e",
      systemDepTx, 6,
    ),
    NervosDao: systemScript(
      "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
      systemDepTx, 2,
    ),
    TypeId: {
      codeHash:
        "0x00000000000000000000000000000000000000000000000000545950455f4944",
      hashType: "type" as const,
      cellDeps: [],
    },
  };

  const client = new ccc.ClientPublicTestnet({
    url: RPC_URL,
    fallbacks: [],
    scripts: scripts as NonNullable<
      ConstructorParameters<typeof ccc.ClientPublicTestnet>[0]
    >["scripts"],
  });

  const keyText = readFileSync("a.key", "utf8").trim();
  const key = keyText.startsWith("0x")
    ? keyText
    : `0x${keyText}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("a.key must contain a 32-byte hex private key.");
  }

  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const recipient = await signer.getRecommendedAddressObj();

  const secretHash = ccc.hashCkb(Buffer.from(SECRET, "utf8"));
  const recipientLockHash = recipient.script.hash();

  const args = ccc.hexFrom(
    "0x0000" +
      vaultCode.codeHash.slice(2) +
      ccc.hexFrom(ccc.hashTypeToBytes(vaultCode.hashType)).slice(2) +
      secretHash.slice(2) +
      recipientLockHash.slice(2),
  );

  if (ccc.bytesFrom(args).length !== 99) {
    throw new Error("Vault lock args must be exactly 99 bytes.");
  }

  const vaultLock = ccc.Script.from({
    codeHash: jsVm.codeHash,
    hashType: jsVm.hashType,
    args,
  });

  console.log("Network:", RPC_URL);
  console.log("Recipient:", recipient.toString());
  console.log("Vault capacity: 300 CKB");
  console.log("Secret hash:", secretHash);

  const tx = ccc.Transaction.from({
    outputs: [{ capacity: CAPACITY, lock: vaultLock }],
    outputsData: ["0x"],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);

  writeFileSync(
    "vault.json",
    JSON.stringify({
      network: "devnet",
      rpcUrl: RPC_URL,
      txHash,
      outputIndex: 0,
      capacity: CAPACITY.toString(),
      recipientAddress: recipient.toString(),
      recipientLockHash,
      secretHash,
      vaultLock: {
        codeHash: vaultLock.codeHash,
        hashType: vaultLock.hashType,
        args: vaultLock.args,
      },
    }, null, 2) + "\n",
  );

  console.log("Create vault tx:", txHash);
  console.log("Saved: vault.json");
  console.log("Waiting for confirmation...");

  await client.waitTransaction(txHash);
  console.log("Vault creation confirmed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});


