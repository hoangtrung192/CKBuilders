import test from 'node:test';
import assert from 'node:assert/strict';
import { textContent, validateImageBytes, friendlyError, imageContent } from './validation';
import { formatCkb } from './amounts';
import { classifyStatus, confirm } from './transactions';
import { validateConfig } from './config';
import type { Session } from './client';
test('UTF-8 byte limits preserve exact input, including multi-byte Vietnamese', () => {
  assert.equal(textContent('a'.repeat(2048)).bytes.length, 2048);
  assert.equal(textContent('ế'.repeat(682)).bytes.length, 2046);
  assert.throws(() => textContent('ế'.repeat(683)), /2 KiB/);
  assert.throws(() => textContent('a'.repeat(2049)), /2 KiB/);
  assert.throws(() => textContent(' \n\t'), /non-empty/);
  assert.equal(new TextDecoder().decode(textContent('  Xin chào 🌱\n').bytes), '  Xin chào 🌱\n');
});
test('image validation rejects empty, oversized, wrong MIME and spoofed files', () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
  validateImageBytes(png, 'image/png'); validateImageBytes(Uint8Array.from([255,216,255,224]), 'image/jpeg');
  assert.throws(() => validateImageBytes(new Uint8Array(), 'image/png'), /empty/);
  assert.throws(() => validateImageBytes(new Uint8Array(20481), 'image/png'), /20 KiB/);
  assert.throws(() => validateImageBytes(png, 'image/jpeg'), /signature/);
  assert.throws(() => validateImageBytes(png, 'image/svg+xml'), /signature/);
  assert.throws(() => validateImageBytes(new TextEncoder().encode('<svg/>'), 'image/png'), /signature/);
});
test('file size is checked before reading a large upload', async () => {
  const file = { size: 20481, arrayBuffer: () => { throw new Error('Must not read'); } } as unknown as File;
  await assert.rejects(() => imageContent(file), /20 KiB/);
});
test('CKB formatting is exact beyond Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatCkb(1n), '0.00000001'); assert.equal(formatCkb(100000001n), '1.00000001');
  assert.equal(formatCkb(4200000000000000n), '42000000'); assert.equal(formatCkb(-10000001n), '-0.10000001');
  assert.equal(formatCkb(900719925474099312345678n), '9007199254740993.12345678');
});
test('pending/unknown status differs from an explicit rejection', () => {
  assert.equal(classifyStatus(undefined), 'pending'); assert.equal(classifyStatus('proposed'), 'pending');
  assert.equal(classifyStatus('rejected'), 'failed'); assert.equal(classifyStatus('committed'), 'committed');
});
test('polling outage preserves transaction hash and reports pending', async () => {
  const session = { client: { getTransactionNoCache: async () => { throw new Error('offline'); } } } as unknown as Session;
  const updates: { phase: string; hash?: string }[] = [];
  assert.equal(await confirm(session, '0x1234', s => updates.push(s), 0), 'pending');
  assert.equal(updates.at(-1)?.hash, '0x1234'); assert.equal(updates.at(-1)?.phase, 'pending');
});
test('useful insufficient capacity and stale input errors', () => {
  assert.match(friendlyError(new Error('Insufficient capacity')), /spendable CKB/);
  assert.match(friendlyError(new Error('dead input')), /Refresh/);
});
test('demo configuration refuses non-devnet and nonlocal endpoints before signing', () => {
  assert.throws(() => validateConfig({ VITE_CHAIN: 'testnet' }), /devnet/);
  assert.throws(() => validateConfig({ VITE_CHAIN: 'mainnet' }), /devnet/);
  assert.throws(() => validateConfig({ VITE_CHAIN: 'devnet', VITE_RPC_URL: 'https://testnet.ckb.dev' }), /local HTTP/);
  assert.throws(() => validateConfig({ VITE_CHAIN: 'devnet', VITE_RPC_URL: 'http://127.0.0.1:28114' }), /genesis/);
});
