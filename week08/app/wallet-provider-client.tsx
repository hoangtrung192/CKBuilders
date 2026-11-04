"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { WalletAccountProvider } from "./wallet-account";

const testnet = new ccc.ClientPublicTestnet();

export default function WalletProviderClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ccc.Provider name="Fiber Mines" defaultClient={testnet}>
      <WalletAccountProvider>{children}</WalletAccountProvider>
    </ccc.Provider>
  );
}
