import test from 'node:test';
import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
import { submitReview, type Review } from './spore';
import type { Session } from './client';
function fixture(changeWallet: boolean, mutateTransaction: boolean) {
  let sent = false;
  const transaction = ccc.Transaction.from({});
  const signer = {
    getRecommendedAddress: async () => changeWallet ? 'different-wallet' : 'reviewed-wallet',
    signTransaction: async (tx: ccc.Transaction) => {
      if (mutateTransaction) tx.version = 1n;
      return tx;
    },
  } as unknown as ccc.Signer;
  const session = {
    signer: async () => signer,
    client: { sendTransaction: async () => { sent = true; return transaction.hash(); } },
  } as unknown as Session;
  const review: Review = { tx: transaction, id: `0x${'0'.repeat(64)}`, account: 'A', from: 'reviewed-wallet', to: 'reviewed-wallet', kind: 'mint', content: { contentType: 'text/plain', bytes: new Uint8Array([65]) }, capacity: 0n, fee: 0n, change: 0n };
  return { session, review, wasSent: () => sent };
}
test('wallet account changes after signature block broadcasting', async () => {
  const { session, review, wasSent } = fixture(true, false);
  await assert.rejects(() => submitReview(session, review, () => {}), /account changed/);
  assert.equal(wasSent(), false);
});
test('wallet cannot change the reviewed raw transaction or mutate the review', async () => {
  const { session, review, wasSent } = fixture(false, true); const before = review.tx.hash();
  await assert.rejects(() => submitReview(session, review, () => {}), /reviewed transaction/);
  assert.equal(wasSent(), false); assert.equal(review.tx.hash(), before);
});
