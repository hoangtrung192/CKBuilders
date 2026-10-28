import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { ContentPreview, CopyValue } from './components';
import { createTestnetSession, explorerTransaction, TESTNET_EXPLORER, TESTNET_FAUCET, TESTNET_GENESIS } from './lib/testnet';
import { listAssets, prepareMint, prepareTransfer, submitReview, verifyOwnerAndContent, type Asset, type Review } from './lib/spore';
import { friendlyError, imageContent, textContent, type Content } from './lib/validation';
import { formatCkb } from './lib/amounts';
import { confirm, type TxStatus } from './lib/transactions';
import type { WalletBalance } from './lib/client';
import './testnet.css';

function loadTransaction(): TxStatus | null {
  try {
    const saved = JSON.parse(localStorage.getItem('week07-testnet-tx') || 'null');
    if (saved?.genesis !== TESTNET_GENESIS || !/^0x[0-9a-f]{64}$/i.test(saved.hash)) return null;
    return { ...saved, phase: ['committed','failed'].includes(saved.phase) ? saved.phase : 'pending' };
  } catch { return null; }
}
function WalletMinter({ client }: { client: ccc.ClientPublicTestnet }) {
  const connector = ccc.useCcc(); const connectedSigner = ccc.useSigner();
  const signerRef = useRef(connectedSigner); signerRef.current = connectedSigner;
  const session = useMemo(() => createTestnetSession(client, () => signerRef.current), [client]);
  const [ready, setReady] = useState(false); const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]); const [selected, setSelected] = useState<Asset | null>(null);
  const [mode, setMode] = useState<'text'|'image'>('text'); const [text, setText] = useState('');
  const [image, setImage] = useState<Content | null>(null); const [fileName, setFileName] = useState('');
  const [recipient, setRecipient] = useState(''); const [review, setReview] = useState<Review | null>(null);
  const [tx, setTx] = useState<TxStatus | null>(loadTransaction); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const actionLock = useRef(false); const refreshVersion = useRef(0); const fileVersion = useRef(0);
  const reviewRef = useRef(review); reviewRef.current = review;
  const unresolved = !!tx?.hash && ['pending','submitted','confirming'].includes(tx.phase);
  const locked = busy || unresolved || !!review;
  let content: Content | null = null; let contentError = '';
  try { content = mode === 'text' ? textContent(text) : image; } catch (e) { contentError = friendlyError(e); }
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      await session.ready(); if (version !== refreshVersion.current) return; setReady(true);
      if (!signerRef.current) { setBalance(null); setAssets([]); setSelected(null); return; }
      const [wallet, collection] = await Promise.all([session.balance('A'), listAssets(session, 'A')]);
      if (version !== refreshVersion.current) return;
      setBalance(wallet); setAssets(collection); setSelected(old => old ? collection.find(a => a.id === old.id) || null : null);
      if (reviewRef.current && reviewRef.current.from !== wallet.address) { setReview(null); setError('Wallet account changed. Build a new review.'); }
    } catch (e) { if (version === refreshVersion.current) { setReady(false); setBalance(null); setAssets([]); setError(friendlyError(e)); } }
  }, [session]);
  useEffect(() => {
    setReview(null); setBalance(null); setAssets([]); setSelected(null); setError(''); void refresh();
    return () => { refreshVersion.current++; };
  }, [connectedSigner, connector.client, refresh]);
  useEffect(() => {
    const onFocus = () => { if (!actionLock.current) void refresh(); };
    window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  useEffect(() => { if (selected) document.getElementById('transfer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [selected?.id]);
  function updateStatus(next: TxStatus) {
    setTx(old => {
      const merged = { account: old?.account, id: old?.id, ...next };
      if (merged.hash) { try { localStorage.setItem('week07-testnet-tx', JSON.stringify({ ...merged, genesis: TESTNET_GENESIS })); } catch {} }
      return merged;
    });
  }
  async function perform(action: () => Promise<void>) {
    if (actionLock.current) return; actionLock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (e) { setError(friendlyError(e)); setTx(old => old?.hash && ['pending','submitted','confirming','committed'].includes(old.phase) ? old : { phase: 'failed', message: friendlyError(e) }); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function build(kind: 'mint'|'transfer') {
    if (locked || !connectedSigner || (kind === 'mint' && !content) || (kind === 'transfer' && !selected)) return;
    await perform(async () => {
      updateStatus({ phase: 'building', account: 'Connected wallet' });
      const built = kind === 'mint' ? await prepareMint(session, 'A', content!) : await prepareTransfer(session, 'A', selected!, recipient);
      if (await (await session.signer('A')).getRecommendedAddress() !== built.from) throw new Error('Wallet changed. Build a new review.');
      setReview(built); updateStatus({ phase: 'review', account: built.from, id: built.id });
    });
  }
  async function sign() {
    if (!review) return; const captured = review;
    await perform(async () => {
      if (await (await session.signer('A')).getRecommendedAddress() !== captured.from) { setReview(null); throw new Error('Wallet account changed. Build a new review.'); }
      const hash = await submitReview(session, captured, s => updateStatus({ ...s, account: captured.from })); setReview(null);
      if (await confirm(session, hash, updateStatus, 120000) === 'committed') {
        await verifyOwnerAndContent(session, captured.id, captured.to, captured.content);
        await refresh(); setNotice(captured.kind === 'mint' ? 'NFT committed on CKB Testnet. Owner and content verified from chain.' : 'Transfer committed on CKB Testnet. Recipient, Spore ID and content verified from chain.');
      }
    });
  }
  async function recheck() {
    if (!tx?.hash) return; const hash = tx.hash;
    await perform(async () => { await session.ready(); if (await confirm(session, hash, updateStatus, 15000) === 'committed') { await refresh(); setNotice('Committed on CKB Testnet. Open the explorer to inspect this transaction.'); } });
  }
  return <div className="shell">
    <header><a className="brand" href="#"><span className="brand-icon">◈</span><span>CKB NFT Minter<small>WEEK07 / DIGITAL OBJECTS</small></span></a><span className="badge">CKB Testnet — Public network</span></header>
    <main><section className="intro"><div><p className="eyebrow">MAKE SOMETHING PERMANENT</p><h1>Your ideas.<br/><em>On the chain.</em></h1><p className="lead">Create and transfer Spore NFTs on CKB Testnet. Every submitted transaction links to the public explorer.</p></div><aside className="intro-note"><span>01 — CONNECT</span><span>02 — CREATE</span><span>03 — TRANSFER</span><p>Original bytes. Immutable content.<br/>Powered by Spore Protocol.</p></aside></section>
      <section className="wallet panel"><div className="wallet-top"><div><p className="eyebrow">YOUR TESTNET WALLET</p><h2>{connector.wallet?.name || 'Connect to get started'}</h2></div><div className="wallet-actions"><span className={`network ${ready ? 'online' : ''}`}>● {ready ? 'Testnet ready' : 'Checking Testnet…'}</span><button className="secondary" disabled={busy} onClick={() => { setError(''); void refresh(); }}>↻ Refresh</button>{connectedSigner ? <button className="secondary" disabled={locked} onClick={() => { connector.disconnect(); }}>Disconnect</button> : <button className="primary" disabled={busy} onClick={() => { connector.open(); }}>Connect Wallet</button>}</div></div>
        {balance ? <><CopyValue value={balance.address}/><div className="balances"><div><small>Total live capacity</small><strong>{formatCkb(balance.total)} <span>CKB</span></strong></div><div><small>Spendable plain-cell capacity</small><strong>{formatCkb(balance.spendable)} <span>CKB</span></strong></div><div><small>Occupied cell storage</small><strong>{formatCkb(balance.occupied)} <span>CKB</span></strong></div></div>{balance.spendable === 0n && <p className="immutable">Copy your address, request free Testnet CKB from the faucet, then refresh.</p>}</> : <p className="muted">Connect your own Testnet wallet and approve signatures there. No private key or seed phrase is entered here.</p>}
        <div className="network-links"><a href={TESTNET_FAUCET} target="_blank" rel="noreferrer">Get free Testnet CKB ↗</a><a href={TESTNET_EXPLORER} target="_blank" rel="noreferrer">Testnet Explorer ↗</a>{balance && <a href={`${TESTNET_EXPLORER}/address/${balance.address}`} target="_blank" rel="noreferrer">View wallet on explorer ↗</a>}</div><p className="muted tiny">Only Testnet CKB is supported. NFT capacity is separate from the network fee. Old Devnet NFTs and hashes belong to a different chain.</p>
      </section>
      {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
      <div className="workspace"><section className="panel create"><div className="section-heading"><span className="step">01</span><div><h2>Create an NFT</h2><p className="muted">Stored on the public CKB Testnet.</p></div></div><fieldset disabled={locked}><div className="segmented wide"><button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Tt &nbsp; Text</button><button className={mode === 'image' ? 'active' : ''} onClick={() => setMode('image')}>▧ &nbsp; Image</button></div>
        {mode === 'text' ? <label>Your words<textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="What would you like to preserve?"/><small className="muted">{new TextEncoder().encode(text).length} / 2048 UTF-8 bytes</small></label> : <label className="file-picker">Choose a PNG or JPEG<input type="file" accept="image/png,image/jpeg" onChange={e => { const file = e.target.files?.[0]; const version = ++fileVersion.current; setImage(null); setFileName(''); setError(''); if (file) void imageContent(file).then(result => { if (version === fileVersion.current) { setImage(result); setFileName(file.name); } }).catch(err => { if (version === fileVersion.current) setError(friendlyError(err)); }); }}/><small className="muted">Original bytes · 20 KiB maximum {fileName}</small></label>}</fieldset>
        <div className="preview"><p className="eyebrow">EXACT CONTENT PREVIEW {content && `· ${content.bytes.length} BYTES`}</p>{content ? <ContentPreview content={content}/> : <p className="muted">{contentError || 'Select a PNG/JPEG to preview.'}</p>}</div><p className="immutable">◇ Content is immutable after creation. Review the exact bytes and costs before signing.</p><button className="primary full" disabled={!ready || !balance || !content || locked} onClick={() => void build('mint')}>Review creation ↗</button>
      </section>
      <section className="panel collection"><div className="section-heading"><span className="step">02</span><div><h2>My Collection <span className="count">{assets.length}</span></h2><p className="muted">Select an NFT below to view or transfer it.</p></div></div>{assets.length ? <div className="asset-grid">{assets.map(asset => <div className={`asset ${selected?.id === asset.id ? 'chosen' : ''}`} key={asset.id}><ContentPreview content={asset}/><div className="asset-caption"><strong>{asset.contentType.split(';')[0]}</strong><span>{asset.id.slice(0,14)}…</span><button className="secondary" disabled={locked} onClick={() => { setSelected(asset); document.getElementById('transfer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>View / Transfer ↗</button></div></div>)}</div> : <div className="empty"><div>◈</div><h3>{connectedSigner ? 'Your Testnet collection' : 'Connect your wallet'}</h3><p className="muted">{connectedSigner ? 'Create an NFT after funding this wallet with Testnet CKB. Devnet NFTs do not appear here.' : 'Your Testnet Spores will be read directly from the chain.'}</p></div>}</section></div>
      {selected && <section className="panel detail" id="transfer-section"><div className="section-heading"><span className="step">03</span><div><h2>Transfer NFT</h2><p className="muted">Send this Spore to another CKB Testnet address.</p></div></div><div className="detail-grid"><div><ContentPreview content={selected}/><p>{selected.contentType} · {selected.bytes.length} bytes · {formatCkb(selected.capacity)} CKB</p><details open><summary>On-chain details</summary><p>Spore ID</p><CopyValue value={selected.id}/><p>Current owner</p><CopyValue value={selected.owner}/><p>Current live OutPoint</p><CopyValue value={`${selected.outPoint.txHash}:${selected.outPoint.index}`}/><a href={explorerTransaction(selected.outPoint.txHash)} target="_blank" rel="noreferrer">View current ownership transaction ↗</a></details></div><div><label>Recipient Testnet address<input placeholder="ckt1…" value={recipient} disabled={locked} onChange={e => setRecipient(e.target.value)}/></label><p className="muted">Paste the recipient’s Testnet wallet address. The ID and immutable bytes are preserved.</p><button className="primary" disabled={!ready || !balance || locked || !recipient.trim()} onClick={() => void build('transfer')}>Review transfer ↗</button></div></div></section>}
      {tx && <section className="panel tx-status" aria-live="polite"><p className="eyebrow">CKB TESTNET TRANSACTION</p><h3>{tx.phase.charAt(0).toUpperCase()+tx.phase.slice(1)}</h3>{tx.message && <p>{tx.message}</p>}{tx.hash && <><CopyValue value={tx.hash}/><div className="network-links"><a className="primary explorer-button" href={explorerTransaction(tx.hash)} target="_blank" rel="noreferrer">View on Testnet Explorer ↗</a><button className="secondary" disabled={busy} onClick={() => void recheck()}>Recheck confirmation</button></div><p className="muted">The explorer may need time to index a new transaction. Pending is not rejected.</p></>}</section>}
      <footer><span>CKB NFT Minter · Trung Do · Week07</span><span>CKB Testnet / Spore Protocol</span></footer>
    </main>
    {review && <div className="modal-backdrop"><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="review-title"><p className="eyebrow">CKB TESTNET · REVIEW BEFORE SIGNING</p><h2 id="review-title">Review {review.kind === 'mint' ? 'creation' : 'transfer'}</h2><ContentPreview content={review.content}/><p>{review.content.contentType} · {review.content.bytes.length} bytes</p><dl><dt>NFT cell capacity</dt><dd>{formatCkb(review.capacity)} CKB</dd><dt>Network fee</dt><dd>{formatCkb(review.fee)} CKB</dd><dt>{review.kind === 'mint' ? 'Capacity + fee' : 'Additional sender cost (fee)'}</dt><dd>{formatCkb(review.kind === 'mint' ? review.capacity + review.fee : review.fee)} CKB</dd><dt>Sender change</dt><dd>{formatCkb(review.change)} CKB</dd></dl><p>From</p><CopyValue value={review.from}/><p>To</p><CopyValue value={review.to}/><p className="immutable">{review.kind === 'mint' ? 'These bytes become immutable on CKB Testnet. Capacity stays in the NFT; the network fee is spent.' : 'This transfers the existing NFT, preserving its ID and content.'} Your wallet will ask you to approve the signature.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => { setReview(null); setTx(null); }}>Cancel</button><button autoFocus className="primary" disabled={busy} onClick={() => void sign()}>{busy ? 'Waiting for wallet / chain…' : 'Confirm in wallet'}</button></div></section></div>}
  </div>;
}
export default function TestnetApp() {
  const [client] = useState(() => new ccc.ClientPublicTestnet({ url: new URL('/rpc', window.location.origin).toString() }));
  const clientOptions = useMemo(() => [{ name: 'CKB Testnet', client }], [client]);
  return <ccc.Provider name="CKB NFT Minter" defaultClient={client} clientOptions={clientOptions} hideKhie><WalletMinter client={client}/></ccc.Provider>;
}
