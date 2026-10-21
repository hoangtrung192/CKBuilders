import { ccc } from "@ckb-ccc/connector-react";

export function openDevnetClient() {
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


  type Options = NonNullable<
    Parameters<typeof ccc.ClientPublicTestnet.open>[0]
  >;

  return ccc.ClientPublicTestnet.open({
    urls: [`${window.location.origin}/ckb`],
    scripts: scripts as Options["scripts"],
  });
}
