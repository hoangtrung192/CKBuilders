import { ccc } from '@ckb-ccc/core';
import { SporeScriptInfo } from '@ckb-ccc/spore';
import { validateConfig, rpc, type Env, type Account } from './config';
export type WalletBalance = { address: string; total: bigint; spendable: bigint; occupied: bigint };
export interface Session {
  client: ccc.ClientPublicTestnet;
  spore: SporeScriptInfo;
  ready(): Promise<{ chain: string }>;
  signer(account: Account): Promise<ccc.Signer>;
  balance(account: Account): Promise<WalletBalance>;
  url: string;
  config: { genesis: string };
}
export function createSession(env: Env, browser = false): Session {
  const config = validateConfig(env);
  const url = browser ? new URL('/rpc', window.location.origin).toString() : config.url;
  const client = new ccc.ClientPublicTestnet({ url, scripts: config.deployment.knownScripts });
  const spore = SporeScriptInfo.from(config.deployment.spore);
  async function ready() {
    const [info, genesis] = await Promise.all([rpc<{ chain: string }>(url, 'get_blockchain_info'), rpc<string>(url, 'get_block_hash', ['0x0'])]);
    if (info.chain !== config.deployment.chainName || !/dev/i.test(info.chain) || genesis !== config.genesis) throw new Error('Chain identity mismatch. Demo signing blocked. After a reset, run pnpm configure and restart Vite.');
    for (const script of [config.deployment.secp, config.deployment.spore]) for (const dep of script.cellDeps) {
      if (!await client.getCellLiveNoCache(dep.cellDep.outPoint, true)) throw new Error('Deployment is stale/dead. Run pnpm configure and restart Vite.');
    }
    // Verify the Spore code hash against live deployment bytes (not a guessed hash).
    const code = await client.getCellLiveNoCache(config.deployment.spore.cellDeps[0].cellDep.outPoint, true);
    if (!code || (spore.hashType !== 'type' && ccc.hashCkb(code.outputData) !== spore.codeHash) || (spore.hashType === 'type' && code.cellOutput.type?.hash() !== spore.codeHash)) throw new Error('Spore deployment hash does not match live code.');
    return info;
  }
  async function signer(account: Account) {
    await ready(); // No private-key signer exists until actual chain identity is verified.
    return new ccc.SignerCkbPrivateKey(client, config.keys[account]);
  }
  async function balance(account: Account) {
    const s = await signer(account); const address = await s.getRecommendedAddressObj();
    let total = 0n, spendable = 0n, occupied = 0n;
    for await (const cell of client.findCells({ script: address.script, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
      total += cell.cellOutput.capacity; occupied += BigInt(cell.occupiedSize) * 100_000_000n;
      if (!cell.cellOutput.type && cell.outputData === '0x') spendable += cell.cellOutput.capacity;
    }
    return { address: address.toString(), total, spendable, occupied };
  }
  return { client, spore, ready, signer, balance, url, config };
}
