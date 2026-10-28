import type { Session } from './client';
export type TxPhase = 'building' | 'review' | 'signing' | 'submitted' | 'confirming' | 'committed' | 'pending' | 'failed';
export type TxStatus = { phase: TxPhase; hash?: string; message?: string; account?: string; id?: string };
export function classifyStatus(status: string | undefined): 'committed' | 'failed' | 'pending' {
  return status === 'committed' ? 'committed' : status === 'rejected' ? 'failed' : 'pending';
}
export async function confirm(session: Session, hash: string, update: (status: TxStatus) => void, timeout = 60000): Promise<TxPhase> {
  const start = Date.now();
  update({ phase: 'confirming', hash });
  do {
    try {
      const tx = await session.client.getTransactionNoCache(hash);
      const phase = classifyStatus(tx?.status);
      if (phase !== 'pending') { update({ phase, hash, message: phase === 'failed' ? 'Transaction rejected. Refresh chain state before rebuilding.' : undefined }); return phase; }
    } catch { /* A polling outage cannot establish rejection. Preserve the hash. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() - start < timeout);
  update({ phase: 'pending', hash, message: 'Confirmation unknown/pending. Recheck this hash; do not submit again.' });
  return 'pending';
}
