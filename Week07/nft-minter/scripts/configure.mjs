import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = process.env.OFFCKB_ROOT || path.join(process.env.APPDATA || '', 'npm/node_modules/@offckb/cli');
const cli = path.join(root, 'build/index.js');
if (!existsSync(cli)) throw new Error('OffCKB not found. Set OFFCKB_ROOT to the installed @offckb/cli directory.');
async function rpc(url, method, params = []) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }), signal: AbortSignal.timeout(4000) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
let url;
for (const port of [28114, 8114]) { const candidate = `http://127.0.0.1:${port}`; try { await rpc(candidate, 'get_blockchain_info'); url = candidate; break; } catch {} }
if (!url) throw new Error('Local RPC unavailable. Start offckb node --daemon, then rerun pnpm configure.');
const info = await rpc(url, 'get_blockchain_info');
if (!/dev/i.test(info.chain)) throw new Error(`Refusing demo accounts on chain ${info.chain}`);
const genesis = await rpc(url, 'get_block_hash', ['0x0']);
execFileSync(process.execPath, [cli, 'system-scripts', '-o', path.resolve('scripts/offckb-scripts.local.json')], { stdio: 'pipe', windowsHide: true });
const scripts = JSON.parse(readFileSync('scripts/offckb-scripts.local.json', 'utf8')).devnet;
if (!scripts.spore) throw new Error('No Spore deployment in OffCKB export.');
const secp = scripts.secp256k1_blake160_sighash_all.script;
const spore = { ...scripts.spore.script, cobuild: true };
for (const s of [secp, spore]) for (const { cellDep } of s.cellDeps) {
  const op = { tx_hash: cellDep.outPoint.txHash, index: `0x${Number(cellDep.outPoint.index).toString(16)}` };
  const live = await rpc(url, 'get_live_cell', [op, true]);
  if (live.status !== 'live') throw new Error('Deployment dependency is dead. Rediscover deployments; do not reuse stale hashes.');
}
const accounts = JSON.parse(readFileSync(path.join(root, 'account/account.json'), 'utf8')).slice(0, 2);
const knownScripts = Object.fromEntries(Object.entries({ Secp256k1Blake160: 'secp256k1_blake160_sighash_all', Secp256k1Multisig: 'secp256k1_blake160_multisig_all', AnyoneCanPay: 'anyone_can_pay', OmniLock: 'omnilock', NervosDao: 'dao', XUdt: 'xudt' }).filter(([,name]) => scripts[name]).map(([known,name]) => [known, scripts[name].script]));
const config = { chainName: info.chain, secp, spore, knownScripts };
writeFileSync('.env.local', ['# PUBLIC disposable OffCKB keys. Never use real funds.', 'VITE_CHAIN=devnet', `VITE_RPC_URL=${url}`, `VITE_EXPECTED_GENESIS_HASH=${genesis}`, `VITE_CHAIN_CONFIG='${JSON.stringify(config)}'`, `VITE_DEMO_KEY_A=${accounts[0].privkey}`, `VITE_DEMO_KEY_B=${accounts[1].privkey}`, ''].join('\n'));
console.log(JSON.stringify({ rpc: url, chain: info.chain, genesis, accounts: accounts.map(({ address }) => address), deployment: spore, saved: '.env.local (keys hidden)' }, null, 2));
