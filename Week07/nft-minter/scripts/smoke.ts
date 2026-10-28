import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { session } from './env';
import { listAssets, prepareMint, prepareTransfer, recipientLock, submitReview } from '../src/lib/spore';
import { textContent } from '../src/lib/validation';
import { confirm } from '../src/lib/transactions';
import type { Content } from '../src/lib/validation';
import { ccc } from '@ckb-ccc/core';
const results: unknown[] = [];
async function mint(content: Content) {
  const review = await prepareMint(session, 'A', content);
  const hash = await submitReview(session, review, s => console.log(s));
  assert.equal(await confirm(session, hash, s => console.log(s)), 'committed');
  const assets = await listAssets(session, 'A'); const asset = assets.find(a => a.id === review.id);
  assert.ok(asset); assert.deepEqual(asset.bytes, content.bytes); assert.equal(asset.contentType, content.contentType);
  const record = { kind: 'mint', type: content.contentType, hash, id: review.id, bytes: content.bytes.length, fee: review.fee.toString() };
  results.push(record); console.log(record); return asset;
}
await session.ready();
await assert.rejects(() => recipientLock(session, 'invalid'), /Invalid recipient/);
const emptySigner = new ccc.SignerCkbPrivateKey(session.client, `0x${'0'.repeat(63)}1`);
const emptyTx = ccc.Transaction.from({ outputs: [{ lock: (await emptySigner.getRecommendedAddressObj()).script, capacity: 100000000000n }] });
await assert.rejects(() => emptyTx.completeInputsByCapacity(emptySigner));
results.push({ check: 'invalid recipient and insufficient capacity', passed: true });
const text = await mint(textContent('Week07 · Xin chào CKB! Immutable UTF-8 Spore.'));
if (!process.argv.includes('--text-only')) {
  const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4s8AAAAASUVORK5CYII=', 'base64'));
  writeFileSync('evidence/smoke-source.png', bytes);
  await mint({ contentType: 'image/png', bytes });
  const b = await session.balance('B');
  const review = await prepareTransfer(session, 'A', text, b.address);
  const hash = await submitReview(session, review, s => console.log(s));
  assert.equal(await confirm(session, hash, s => console.log(s)), 'committed');
  const aAfter = await listAssets(session, 'A'); const bAfter = await listAssets(session, 'B');
  assert.ok(!aAfter.some(a => a.id === text.id));
  const received = bAfter.find(a => a.id === text.id); assert.ok(received);
  assert.deepEqual(received.bytes, text.bytes); assert.equal(received.data, text.data); assert.equal(received.owner, b.address);
  results.push({ kind: 'transfer', hash, id: text.id, from: text.owner, to: b.address, unchangedData: true, absentFromA: true, presentInB: true });
}
writeFileSync(`evidence/${process.argv.includes('--text-only') ? 'text-smoke' : 'chain-smoke'}.json`, JSON.stringify({ at: new Date().toISOString(), genesis: session.config.genesis, results }, null, 2));
console.log('PASS: live chain checks and byte comparisons.');
