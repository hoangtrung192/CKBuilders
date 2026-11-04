export type ChainStatus = "closing" | "pending" | "confirmed" | "rejected";
export type LockScript = {
  code_hash: string;
  hash_type: "type" | "data" | "data1" | "data2";
  args: string;
};
export type RoundSettlement = {
  channelId: string;
  fundingOutpoint: { tx_hash: string; index: string };
  walletAddress: string;
  closeScript: LockScript;
  closeRequestedAt?: number;
  closeTxHash?: string;
  closeStatus?: ChainStatus;
  closeBlockHash?: string;
  returnedAmount?: string;
  proofDigest?: string;
  proofTxHash?: string;
  proofStatus?: "pending" | "confirmed" | "rejected";
  proofBlockHash?: string;
};
