import { ccc } from '@ckb-ccc/core';
import { createSpore, transferSpore, findSpore, findSporesBySigner } from '@ckb-ccc/spore';
import type { Account } from './config';
import type { Session } from './client';
import type { Content } from './validation';
import type { TxStatus } from './transactions';
export type Asset = { id: string; contentType: string; bytes: Uint8Array; owner: string; capacity: bigint; outPoint: { txHash: string; index: bigint }; data: string };
export type Review = { tx: ccc.Transaction; id: string; account: Account; from: string; to: string; capacity: bigint; fee: bigint; change: bigint; kind: 'mint' | 'transfer'; content: Content; liveInput?: ccc.OutPoint };
export async function listAssets(session: Session, account: Account): Promise<Asset[]> {
  const signer = await session.signer(account); const assets: Asset[] = [];
  for await (const { spore, sporeData } of findSporesBySigner({ signer, scriptInfos: [session.spore] })) {
    assets.push({ id: spore.cellOutput.type!.args, contentType: sporeData.contentType, bytes: ccc.bytesFrom(sporeData.content), owner: ccc.Address.fromScript(spore.cellOutput.lock, session.client).toString(), capacity: spore.cellOutput.capacity, outPoint: spore.outPoint, data: spore.outputData });
  }
  return assets;
}
export async function verifyOwnerAndContent(session: Session, id: string, owner: string, content: Content) {
  const result = await findSpore(session.client, id, [session.spore]);
  if (!result || !await session.client.getCellLiveNoCache(result.spore.outPoint, true)) throw new Error('Committed; live Spore not indexed yet. Refresh to verify.');
  const actualOwner = ccc.Address.fromScript(result.spore.cellOutput.lock, session.client).toString();
  if (actualOwner !== owner || result.sporeData.contentType !== content.contentType || !ccc.bytesEq(result.sporeData.content, content.bytes)) throw new Error('Committed; indexed ownership/content does not match. Refresh and inspect on-chain details.');
}
export async function recipientLock(session: Session, address: string) {
  try { return (await ccc.Address.fromString(address.trim(), session.client)).script; }
  catch { throw new Error('Invalid recipient. Enter a valid ckt address for the active CKB network.'); }
}
async function finish(session: Session, account: Account, tx: ccc.Transaction, id: string, to: string, kind: Review['kind'], content: Content, liveInput?: ccc.OutPoint): Promise<Review> {
  const signer = await session.signer(account);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  const index = tx.outputs.findIndex(o => o.type?.args === id && o.type?.codeHash === session.spore.codeHash);
  if (index < 0) throw new Error('Spore output missing.');
  const capacity = tx.outputs[index].capacity;
  const fee = await tx.getFee(session.client);
  const ownerLocks = (await signer.getAddressObjs()).map(address => address.script);
  const change = tx.outputs.reduce((n, o, i) => n + (i !== index && ownerLocks.some(lock => o.lock.eq(lock)) && !o.type ? o.capacity : 0n), 0n);
  return { tx, id, account, from: await signer.getRecommendedAddress(), to, kind, content, capacity, fee, change, liveInput };
}
export async function prepareMint(session: Session, account: Account, content: Content): Promise<Review> {
  const signer = await session.signer(account);
  const { tx, id } = await createSpore({ signer, scriptInfo: session.spore, data: { contentType: content.contentType, content: content.bytes } });
  return finish(session, account, tx, id, await signer.getRecommendedAddress(), 'mint', content);
}
export async function prepareTransfer(session: Session, account: Account, asset: Asset, recipient: string): Promise<Review> {
  const signer = await session.signer(account); const to = await recipientLock(session, recipient);
  const found = await findSpore(session.client, asset.id, [session.spore]);
  if (!found || !await session.client.getCellLiveNoCache(found.spore.outPoint, true)) throw new Error('Spore is no longer live. Refresh collection.');
  if (!(await signer.getAddressObjs()).some(address => found.spore.cellOutput.lock.eq(address.script))) throw new Error('This account no longer owns the Spore. Refresh collection.');
  if (found.spore.outputData !== asset.data || !found.spore.outPoint.eq(asset.outPoint)) throw new Error('Stale Spore. Refresh the collection before retrying.');
  const { tx } = await transferSpore({ signer, id: asset.id, to, scripts: [session.spore] });
  return finish(session, account, tx, asset.id, ccc.Address.fromScript(to, session.client).toString(), 'transfer', { contentType: asset.contentType, bytes: asset.bytes }, found.spore.outPoint);
}
export async function submitReview(session: Session, review: Review, update: (s: TxStatus) => void): Promise<string> {
  const signer = await session.signer(review.account);
  for (const input of review.tx.inputs) if (!await session.client.getCellLiveNoCache(input.previousOutput, true)) throw new Error('An input is dead. Refresh and rebuild the review.');
  update({ phase: 'signing', account: review.account, id: review.id });
  const reviewedHash = review.tx.hash();
  const signed = await signer.signTransaction(review.tx.clone());
  const currentSigner = await session.signer(review.account);
  if (await currentSigner.getRecommendedAddress() !== review.from) throw new Error('Wallet account changed. Reconnect and build a new review.');
  if (signed.hash() !== reviewedHash) throw new Error('Wallet changed the reviewed transaction. Build a new review before sending.');
  if (await signed.getFee(session.client) !== review.fee) throw new Error('Fee changed. Build a new review.');
  const hash = signed.hash();
  // Persist the deterministic hash before the RPC call: an interrupted response may still mean acceptance.
  update({ phase: 'submitted', hash, account: review.account, id: review.id });
  try { await session.client.sendTransaction(signed); }
  catch (error) {
    update({ phase: 'pending', hash, account: review.account, id: review.id, message: `Submission response uncertain. Recheck the hash. ${error instanceof Error ? error.message : String(error)}` });
    return hash;
  }
  return hash;
}
