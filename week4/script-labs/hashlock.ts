import { ccc } from "@ckb-ccc/core";
import { readFileSync, writeFileSync } from "node:fs";

const SECRET = ccc.hexFrom(Buffer.from("hello-ckb", "utf8"));
const STATE_FILE = "./hashlock-cell.json";

const GENESIS_TX =
  "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7";

const SECP_TX =
  "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293";

function systemScript(codeHash: string, index: number) {
  return {
    codeHash,
    hashType: "type" as const,
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash: GENESIS_TX,
            index,
          },
          depType: "code" as const,
        },
      },
    ],
  };
}

const SECP = {
  codeHash:
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type" as const,
  cellDeps: [
    {
      cellDep: {
        outPoint: {
          txHash: SECP_TX,
          index: 0,
        },
        depType: "depGroup" as const,
      },
    },
  ],
};

const OMNI = systemScript(
  "0x9c6933d977360f115a3e9cd5a2e0e475853681b80d775d93ad0f8969da343e56",
  7,
);

type DeploymentInfo = {
  codeHash: string;
  hashType: ccc.HashType;
  cellDeps: Array<{
    cellDep: {
      outPoint: {
        txHash: string;
        index: number;
      };
      depType: "code" | "depGroup";
    };
  }>;
};

function loadDeployment(path: string, name: string): DeploymentInfo {
  const file = JSON.parse(readFileSync(path, "utf8"));
  const info = file.devnet?.[name];

  if (!info) {
    throw new Error(`Không tìm thấy ${name} trong ${path}`);
  }

  return info;
}

async function main() {
  const [command, keyPath] = process.argv.slice(2);

  if (!["create", "unlock"].includes(command) || !keyPath) {
    throw new Error(
      "Cách chạy: pnpm exec tsx hashlock.ts create|unlock <file.key>",
    );
  }

  const client = new ccc.ClientPublicTestnet({
    url: "http://127.0.0.1:8114",
    fallbacks: [],
    scripts: {
      [ccc.KnownScript.Secp256k1Blake160]: SECP,

      [ccc.KnownScript.Secp256k1Multisig]: {
        codeHash:
          "0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
        hashType: "type",
        cellDeps: [
          {
            cellDep: {
              outPoint: {
                txHash: SECP_TX,
                index: 1,
              },
              depType: "depGroup",
            },
          },
        ],
      },

      [ccc.KnownScript.AnyoneCanPay]: systemScript(
        "0xe09352af0066f3162287763ce4ddba9af6bfaeab198dc7ab37f8c71c9e68bb5b",
        8,
      ),

      [ccc.KnownScript.NervosDao]: systemScript(
        "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
        2,
      ),

      [ccc.KnownScript.XUdt]: systemScript(
        "0x1a1e4fef34f5982906f745b048fe7b1089647e82346074e0f32c2ece26cf6b1e",
        6,
      ),

      [ccc.KnownScript.OmniLock]: {
        ...OMNI,
        cellDeps: [...OMNI.cellDeps, ...SECP.cellDeps],
      },

      [ccc.KnownScript.TypeId]: {
        codeHash:
          "0x00000000000000000000000000000000000000000000000000545950455f4944",
        hashType: "type",
        cellDeps: [],
      },
    },
  });

  const key = readFileSync(keyPath, "utf8")
    .replace(/^\uFEFF/, "")
    .trim();

  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const address = await signer.getRecommendedAddress();
  const walletLock = (
    await ccc.Address.fromString(address, client)
  ).script;

  const contract = loadDeployment(
    "./deployment/scripts.json",
    "index.bc",
  );

  const vm = loadDeployment(
    "./deployment-vm/scripts.json",
    "ckb-js-vm",
  );

  // 2 byte loader flags + 32 byte code hash + 1 byte hash type.
  const loaderArgs =
    "0x0000" +
    contract.codeHash.slice(2) +
    ccc.hexFrom(ccc.hashTypeToBytes(contract.hashType)).slice(2);

  const hashLock = ccc.Script.from({
    codeHash: vm.codeHash,
    hashType: vm.hashType,
    args: loaderArgs + ccc.hashCkb(SECRET).slice(2),
  });

  const deps = [
    ...SECP.cellDeps.map((item) => item.cellDep),
    ...vm.cellDeps.map((item) => item.cellDep),
    ...contract.cellDeps.map((item) => item.cellDep),
  ];

  console.log("Network: OffCKB Devnet");
  console.log("Wallet:", address);

  if (command === "create") {
    const tx = ccc.Transaction.from({
      cellDeps: deps,
      outputs: [
        {
          capacity: ccc.fixedPointFrom("200"),
          lock: hashLock,
        },
      ],
      outputsData: ["0x"],
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000n);

    const txHash = await signer.sendTransaction(tx);
    console.log("Create tx:", txHash);

    const confirmed = await client.waitTransaction(txHash);

    if (!confirmed) {
      throw new Error(
        "Chưa xác nhận giao dịch; giữ lại Create tx để kiểm tra",
      );
    }

    const outPoint = { txHash, index: 0 };

    // Lưu OutPoint ngay sau xác nhận để có thể mở cell sau này.
    writeFileSync(
      STATE_FILE,
      JSON.stringify(outPoint, null, 2),
    );

    const cell = await client.getCellLive(outPoint, true);

    if (!cell) {
      throw new Error(
        "Đã lưu OutPoint nhưng chưa đọc được live cell; không chạy create lại",
      );
    }

    console.log("Status: committed");
    console.log("Hash-lock cell: live");
    console.log(
      "Capacity:",
      ccc.fixedPointToString(cell.cellOutput.capacity),
      "CKB",
    );
    console.log("OutPoint:", JSON.stringify(outPoint));
    console.log("Saved public OutPoint to:", STATE_FILE);
    return;
  }

  const outPoint = JSON.parse(
    readFileSync(STATE_FILE, "utf8"),
  );

  const cell = await client.getCellLive(outPoint, true);

  if (!cell) {
    throw new Error("Cell không còn live hoặc không tồn tại");
  }

  const lock = cell.cellOutput.lock;

  if (
    lock.codeHash !== hashLock.codeHash ||
    lock.hashType !== hashLock.hashType ||
    lock.args !== hashLock.args
  ) {
    throw new Error("Cell không khớp hash-lock của bài này");
  }

  const witness = ccc.WitnessArgs.from({
    lock: SECRET,
  });

  const tx = ccc.Transaction.from({
    cellDeps: deps,
    inputs: [
      {
        previousOutput: outPoint,
      },
    ],
    outputs: [
      {
        capacity:
          cell.cellOutput.capacity - ccc.fixedPointFrom("1"),
        lock: walletLock,
      },
    ],
    outputsData: ["0x"],
    witnesses: [ccc.hexFrom(witness.toBytes())],
  });

  // Trả phần capacity dư về output 0 sau khi tính phí.
  await tx.completeFeeChangeToOutput(signer, 0, 1000n);

  const txHash = await signer.sendTransaction(tx);
  console.log("Unlock tx:", txHash);

  const confirmed = await client.waitTransaction(txHash);

  if (!confirmed) {
    throw new Error(
      "Chưa xác nhận giao dịch; giữ lại Unlock tx để kiểm tra",
    );
  }

  const oldCell = await client.getCellLive(outPoint, true);
  const returnedCell = await client.getCellLive(
    { txHash, index: 0 },
    true,
  );

  if (oldCell || !returnedCell) {
    throw new Error(
      "Giao dịch đã xác nhận; cần kiểm tra lại trạng thái cell",
    );
  }

  console.log("Status: committed");
  console.log("Original hash-lock cell: spent");
  console.log(
    "Returned capacity:",
    ccc.fixedPointToString(returnedCell.cellOutput.capacity),
    "CKB",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});