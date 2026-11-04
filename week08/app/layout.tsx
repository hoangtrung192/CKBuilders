import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./wallet-provider";
export const metadata: Metadata = {
  title: "Fiber Mines · CKB Testnet",
  description:
    "Week08 · 3×3 mines with verifiable boards and Fiber Testnet payments",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
