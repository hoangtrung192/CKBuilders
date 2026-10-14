// Public-only setup for a short Testnet timelock. No signing, keys, or files.
const { createRequire } = require('node:module');
const { join } = require('node:path');
const requireWeek4 = createRequire(join(__dirname, '..', '..', 'week4', 'script-labs', 'package.json'));
const ccc = requireWeek4('@ckb-ccc/core');

const RPC = 'https://testnet.ckbapp.dev/';
const TESTNET_GENESIS = '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
// Public funding lock arg verified from Fiber node A and ckb-cli account #0.
const OWNER = '0x6a33715b478985fe5fd18957c27f507b5de8aa5f';

async function rpc(method, params = []) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

async function main() {
  if (await rpc('get_block_hash', ['0x0']) !== TESTNET_GENESIS) {
    throw new Error('RPC is not CKB Testnet.');
  }
  const tip = await rpc('get_tip_header');
  const epoch = ccc.epochFrom(tip.epoch);
  if (process.argv[2] === 'status') {
    const target = ccc.epochFrom(process.argv[3]);
    const currentValue = (epoch.integer * epoch.denominator + epoch.numerator) * target.denominator;
    const targetValue = (target.integer * target.denominator + target.numerator) * epoch.denominator;
    console.log(JSON.stringify({ current_epoch: tip.epoch, unlock_epoch: process.argv[3], ready: currentValue >= targetValue }));
    return;
  }
  const blocks = Number(process.argv[2] ?? 40);
  if (!Number.isInteger(blocks) || blocks < 10 || blocks > 120) {
    throw new Error('Use an approximate delay from 10 to 120 blocks.');
  }
  const numerator = epoch.numerator + BigInt(blocks);
  const unlockEpoch = ccc.epochToHex({
    integer: epoch.integer + numerator / epoch.denominator,
    numerator: numerator % epoch.denominator,
    denominator: epoch.denominator,
  });
  const since = ccc.Since.from({ relative: 'absolute', metric: 'epoch', value: unlockEpoch });
  const multisig = ccc.MultisigCkbWitness.from({ publicKeyHashes: [OWNER], threshold: 1, mustMatch: 0 });
  const client = new ccc.ClientPublicTestnet({ url: RPC, fallbacks: [] });
  const script = await ccc.Script.fromKnownScript(client, ccc.KnownScript.Secp256k1Multisig, ccc.hexFrom(multisig.scriptArgs(since)));
  console.log(JSON.stringify({
    network: 'CKB Testnet',
    owner_lock_arg: OWNER,
    prepared_tip: tip.number,
    unlock_epoch: unlockEpoch,
    approximate_delay_blocks: blocks,
    since: ccc.numToHex(since.toNum()),
    locked_address: ccc.Address.fromScript(script, client).toString(),
  }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
