import { ccc } from '@ckb-ccc/core';
import { SporeScriptInfo } from '@ckb-ccc/spore';
export type Env = Record<string, string | undefined>;
export type Account = 'A' | 'B';
export type Deployment = { chainName: string; secp: ccc.ScriptInfoLike; spore: Parameters<typeof SporeScriptInfo.from>[0]; knownScripts: ccc.ClientConfig['scripts'] };
export function validateConfig(env: Env) {
  if (env.VITE_CHAIN !== 'devnet') throw new Error('Demo signers require explicit VITE_CHAIN=devnet.');
  const url = new URL(env.VITE_RPC_URL || 'http://127.0.0.1:28114');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Demo signers require a local HTTP RPC.');
  if (!/^0x[0-9a-f]{64}$/i.test(env.VITE_EXPECTED_GENESIS_HASH || '')) throw new Error('Run pnpm configure to pin the local genesis hash.');
  let deployment: Deployment;
  try { deployment = JSON.parse(env.VITE_CHAIN_CONFIG || ''); } catch { throw new Error('Run pnpm configure to discover live deployments.'); }
  if (!/dev/i.test(deployment.chainName)) throw new Error('The configured chain must be Devnet.');
  for (const key of ['VITE_DEMO_KEY_A', 'VITE_DEMO_KEY_B']) if (!/^0x[0-9a-f]{64}$/i.test(env[key] || '')) throw new Error('Demo keys missing. Run pnpm configure.');
  if (env.VITE_DEMO_KEY_A === env.VITE_DEMO_KEY_B) throw new Error('Demo accounts must be distinct.');
  return { url: url.toString(), genesis: env.VITE_EXPECTED_GENESIS_HASH!, deployment, keys: { A: env.VITE_DEMO_KEY_A!, B: env.VITE_DEMO_KEY_B! } };
}
export async function rpc<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}. Check OffCKB and the Vite proxy.`);
  const result = await response.json(); if (result.error) throw new Error(result.error.message); return result.result;
}
