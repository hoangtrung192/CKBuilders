import { session } from './env';
import { formatCkb } from '../src/lib/amounts';
console.log({ network: await session.ready(), rpc: session.url, genesis: session.config.genesis, sporeCodeHash: session.spore.codeHash });
for (const account of ['A', 'B'] as const) {
  const b = await session.balance(account);
  console.log({ account, address: b.address, totalCkb: formatCkb(b.total), spendableCkb: formatCkb(b.spendable), occupiedCkb: formatCkb(b.occupied) });
}
