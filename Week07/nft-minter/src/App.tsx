import { lazy, Suspense } from 'react';
const TestnetApp = lazy(() => import('./TestnetApp'));
const DevnetApp = lazy(() => import('./DevnetApp'));
export default function App() {
  const chain = import.meta.env.VITE_CHAIN || 'testnet';
  if (!['devnet','testnet'].includes(chain)) return <main><p role="alert">Unsupported network. Choose CKB Testnet or the local Devnet configuration.</p></main>;
  return <Suspense fallback={<main><p>Loading CKB NFT Minter…</p></main>}>{chain === 'devnet' ? <DevnetApp/> : <TestnetApp/>}</Suspense>;
}
