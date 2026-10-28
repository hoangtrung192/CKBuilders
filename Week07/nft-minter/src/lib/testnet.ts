import { ccc } from '@ckb-ccc/core';
import { getSporeScriptInfo } from '@ckb-ccc/spore';
import { rpc } from './config';
import type { Session, WalletBalance } from './client';

export const TESTNET_RPC = 'https://testnet.ckb.dev/';
// Independently checked against both official public Testnet RPCs.
export const TESTNET_GENESIS = '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
export const TESTNET_EXPLORER = 'https://pudge.explorer.nervos.org';
export const TESTNET_FAUCET = 'https://faucet.nervos.org/';
export function explorerTransaction(hash: string): string {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Invalid transaction hash.');
  return `${TESTNET_EXPLORER}/transaction/${hash}`;
}
export function assertTestnetIdentity(chain: string, genesis: string) {
  if (chain !== 'ckb_testnet' || genesis !== TESTNET_GENESIS) throw new Error('Network identity mismatch. This app requires the public CKB Testnet; signing is blocked.');
}
function underlyingClient(client: ccc.Client): ccc.Client {
  // CCC's connector wraps the selected client to support custom fee rates.
  // Compare the original clients so that wrapper changes aren't network changes.
  while (ccc.Proxy.inner in client) {
    client = (client as ccc.Client & { [ccc.Proxy.inner]: ccc.Client })[ccc.Proxy.inner];
  }
  return client;
}
export function assertTestnetSigner(client: ccc.Client, signer?: ccc.Signer): asserts signer is ccc.Signer {
  if (!signer) throw new Error('Connect a Testnet wallet first.');
  if (underlyingClient(signer.client) !== underlyingClient(client)) throw new Error('Wallet network changed. Reconnect using CKB Testnet.');
  if (signer instanceof ccc.SignerCkbPrivateKey) throw new Error('Built-in private-key signing is disabled on Testnet. Connect your own wallet.');
}
export async function walletBalance(client: ccc.Client, signer: ccc.Signer): Promise<WalletBalance> {
  const addresses = await signer.getAddressObjs();
  const seen = new Set<string>(); let total = 0n, spendable = 0n, occupied = 0n;
  for (const address of addresses) {
    if (seen.has(address.script.hash())) continue; seen.add(address.script.hash());
    for await (const cell of client.findCells({ script: address.script, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
      total += cell.cellOutput.capacity; occupied += BigInt(cell.occupiedSize) * 100_000_000n;
      if (!cell.cellOutput.type && cell.outputData === '0x') spendable += cell.cellOutput.capacity;
    }
  }
  return { address: await signer.getRecommendedAddress(), total, spendable, occupied };
}
export function createTestnetSession(client: ccc.ClientPublicTestnet, currentSigner: () => ccc.Signer | undefined): Session {
  const spore = getSporeScriptInfo(client);
  async function ready() {
    const [info, genesis] = await Promise.all([rpc<{ chain: string }>(client.url, 'get_blockchain_info'), rpc<string>(client.url, 'get_block_hash', ['0x0'])]);
    assertTestnetIdentity(info.chain, genesis);
    for (const dep of spore.cellDeps) if (!await client.getCellLiveNoCache(dep.cellDep.outPoint, true)) throw new Error('Testnet Spore deployment is unavailable. Retry when the RPC is ready.');
    const code = await client.getCellLiveNoCache(spore.cellDeps[0].cellDep.outPoint, true);
    if (!code || (spore.hashType === 'type' ? code.cellOutput.type?.hash() : ccc.hashCkb(code.outputData)) !== spore.codeHash) throw new Error('Testnet Spore code hash does not match its live deployment.');
    return info;
  }
  async function signer() { await ready(); const connected = currentSigner(); assertTestnetSigner(client, connected); return connected; }
  return { client, spore, ready, signer, balance: async () => walletBalance(client, await signer()), url: client.url, config: { genesis: TESTNET_GENESIS } };
}
