import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
if (existsSync('.env.local') && /^VITE_CHAIN=devnet$/m.test(readFileSync('.env.local', 'utf8'))) {
  copyFileSync('.env.local', '.env.devnet.local');
  console.log('Preserved previous local Devnet configuration in ignored .env.devnet.local (no keys printed).');
}
writeFileSync('.env.local', '# CKB public Testnet. Wallet signatures only; no demo keys.\nVITE_CHAIN=testnet\nVITE_TESTNET_RPC_URL=https://testnet.ckb.dev/\n');
console.log('CKB Testnet enabled. Restart Vite, connect a wallet, obtain free Testnet CKB, then mint. Existing Devnet hashes remain historical.');
