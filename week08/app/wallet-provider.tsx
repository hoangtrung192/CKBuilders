"use client";

import dynamic from "next/dynamic";

// Mount CCC after hydration so React assigns its network client before the
// custom element starts discovering wallets.
const Provider = dynamic(() => import("./wallet-provider-client"), {
  ssr: false,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
