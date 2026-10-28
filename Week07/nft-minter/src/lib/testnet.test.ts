import test from 'node:test';
import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
import { assertTestnetIdentity, assertTestnetSigner, createTestnetSession, explorerTransaction, TESTNET_GENESIS, TESTNET_RPC } from './testnet';
test('Testnet requires exact public chain identity, not just ckt prefix', () => {
  assertTestnetIdentity('ckb_testnet', TESTNET_GENESIS);
  assert.throws(() => assertTestnetIdentity('ckb_dev', TESTNET_GENESIS), /mismatch/);
  assert.throws(() => assertTestnetIdentity('ckb', TESTNET_GENESIS), /mismatch/);
  assert.throws(() => assertTestnetIdentity('ckb_testnet', `0x${'0'.repeat(64)}`), /mismatch/);
});
test('Explorer links point to public Testnet and reject invalid hashes', () => {
  const hash = `0x${'a'.repeat(64)}`;
  assert.equal(explorerTransaction(hash), `https://pudge.explorer.nervos.org/transaction/${hash}`);
  assert.throws(() => explorerTransaction('javascript:alert(1)'), /Invalid/);
});
test('No Testnet signer is created without a connected external wallet', () => {
  const client = new ccc.ClientPublicTestnet({ url: TESTNET_RPC });
  const session = createTestnetSession(client, () => undefined);
  assert.ok(session.spore.codeHash); assert.equal(session.config.genesis, TESTNET_GENESIS);
  assert.throws(() => assertTestnetSigner(client), /Connect/);
  const privateSigner = new ccc.SignerCkbPrivateKey(client, `0x${'0'.repeat(63)}1`);
  assert.throws(() => assertTestnetSigner(client, privateSigner), /private-key/);
  const other = new ccc.ClientPublicTestnet({ url: TESTNET_RPC });
  assert.throws(() => assertTestnetSigner(other, privateSigner), /network changed/);
});

test('CCC client wrappers preserve wallet network identity', () => {
  const client = new ccc.ClientPublicTestnet({ url: TESTNET_RPC });
  const WrappedClient = ccc.Proxy.Base(ccc.ClientPublicTestnet);
  const wrapped = new WrappedClient(client);
  const nested = new WrappedClient(wrapped);
  const lock = { codeHash: `0x${'1'.repeat(64)}`, hashType: 'type' as const, args: '0x' };
  const signer = new ccc.SignerCkbScriptReadonly(wrapped, lock);
  assert.doesNotThrow(() => assertTestnetSigner(client, signer));
  assert.doesNotThrow(() => assertTestnetSigner(nested, signer));
  assert.doesNotThrow(() => assertTestnetSigner(wrapped, new ccc.SignerCkbScriptReadonly(client, lock)));

  const other = new ccc.ClientPublicTestnet({ url: TESTNET_RPC });
  assert.throws(() => assertTestnetSigner(other, signer), /network changed/);
  assert.throws(() => assertTestnetSigner(client, new ccc.SignerCkbScriptReadonly(new ccc.ClientPublicMainnet(), lock)), /network changed/);
  assert.throws(() => assertTestnetSigner(client, new ccc.SignerCkbPrivateKey(nested, `0x${'0'.repeat(63)}1`)), /private-key/);
});
