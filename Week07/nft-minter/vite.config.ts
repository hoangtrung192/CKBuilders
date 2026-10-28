import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const chain = env.VITE_CHAIN || 'testnet';
  const target = chain === 'testnet' ? (env.VITE_TESTNET_RPC_URL || 'https://testnet.ckb.dev/') : (env.VITE_RPC_URL || 'http://127.0.0.1:28114');
  const url = new URL(target);
  if (chain === 'testnet') {
    if (url.protocol !== 'https:' || !['testnet.ckb.dev','testnet.ckbapp.dev'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Use an official HTTPS CKB Testnet RPC.');
  } else if (chain !== 'devnet' || url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Devnet demo RPC must be local HTTP.');
  return { plugins: [react()], server: { host: '127.0.0.1', proxy: { '/rpc': { target, changeOrigin: true, rewrite: () => '/' } } }, preview: { host: '127.0.0.1', proxy: { '/rpc': { target, changeOrigin: true, rewrite: () => '/' } } } };
});
