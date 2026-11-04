"use client";
import { ccc } from "@ckb-ccc/connector-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Account = { signer: ccc.Signer; address: string; balance: bigint };
const Context = createContext<{
  account?: Account;
  error: string;
  refresh: () => Promise<void>;
}>({ error: "", refresh: async () => {} });
export function WalletAccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const signer = ccc.useSigner();
  const [account, setAccount] = useState<Account>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    async function read() {
      try {
        if (signer!.client.addressPrefix !== "ckt")
          throw new Error("Connect a CKB Testnet wallet.");
        const address = await signer!.getRecommendedAddress();
        if (!address.startsWith("ckt1"))
          throw new Error("A CKB Testnet account is required.");
        const balance = await signer!.getBalance();
        if (!cancelled) {
          setAccount({ signer: signer!, address, balance });
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setAccount(undefined);
          setError(e instanceof Error ? e.message : "Could not read wallet.");
        }
      }
    }
    void read();
    const timer = setInterval(() => {
      void read();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [signer, revision]);
  const refresh = useCallback(async () => {
    setRevision((value) => value + 1);
  }, []);
  return (
    <Context.Provider
      value={{
        account: account?.signer === signer ? account : undefined,
        error: signer ? error : "",
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useWalletAccount = () => useContext(Context);
