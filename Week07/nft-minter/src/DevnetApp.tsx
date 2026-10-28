import { useEffect, useRef, useState } from 'react';
import { createSession } from './lib/client';
import type { Session } from './lib/client';
import type { Account } from './lib/config';
import { listAssets, prepareMint, prepareTransfer, submitReview, verifyOwnerAndContent } from './lib/spore';
import type { Asset, Review } from './lib/spore';
import { checkDecodable, friendlyError, imageContent, textContent, validateImageBytes } from './lib/validation';
import type { Content } from './lib/validation';
import { formatCkb } from './lib/amounts';
import { confirm } from './lib/transactions';
import type { TxStatus } from './lib/transactions';

function ContentPreview({ content }: { content: Content }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true; let objectUrl = ''; setUrl('');
    if (['image/png', 'image/jpeg'].includes(content.contentType)) {
      void (async () => { try { validateImageBytes(content.bytes, content.contentType); await checkDecodable(content.bytes, content.contentType); if (active) { objectUrl = URL.createObjectURL(new Blob([new Uint8Array(content.bytes)], { type: content.contentType })); setUrl(objectUrl); } } catch { /* Safe fallback for unsupported chain data. */ } })();
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [content]);
  if (content.contentType.split(';')[0] === 'text/plain') return <pre className="text-preview">{new TextDecoder().decode(content.bytes)}</pre>;
  return url ? <img className="image-preview" src={url} alt="Exact NFT content" /> : <p className="muted">Image unavailable or unsupported content. Data is never executed.</p>;
}
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-value"><code>{value}</code><button className="subtle" onClick={() => { void navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : 'Copy'}</button></div>;
}
type Wallet = Awaited<ReturnType<Session['balance']>>;
function loadStatus(): TxStatus | null {
  try { const saved = JSON.parse(localStorage.getItem('week07-tx') || 'null'); return saved && saved.genesis === import.meta.env.VITE_EXPECTED_GENESIS_HASH && /^0x[0-9a-f]{64}$/i.test(saved.hash) ? { ...saved, phase: saved.phase === 'committed' || saved.phase === 'failed' ? saved.phase : 'pending' } : null; } catch { return null; }
}
export default function DevnetApp() {
  const [initial] = useState(() => { try { return { session: createSession(import.meta.env, true), error: '' }; } catch (e) { return { session: null, error: friendlyError(e) }; } });
  const session = initial.session;
  const [account, setAccount] = useState<Account>('A'); const [wallets, setWallets] = useState<Partial<Record<Account, Wallet>>>({});
  const [ready, setReady] = useState(false); const [assets, setAssets] = useState<Asset[]>([]); const [selected, setSelected] = useState<Asset | null>(null);
  const [mode, setMode] = useState<'text' | 'image'>('text'); const [text, setText] = useState(''); const [image, setImage] = useState<Content | null>(null); const [fileName, setFileName] = useState('');
  const [recipient, setRecipient] = useState(''); const [review, setReview] = useState<Review | null>(null); const [tx, setTx] = useState<TxStatus | null>(loadStatus);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(initial.error); const [notice, setNotice] = useState('');
  const actionLock = useRef(false); const refreshVersion = useRef(0); const fileVersion = useRef(0);
  const wallet = wallets[account];
  const unresolved = !!tx?.hash && ['pending','submitted','confirming'].includes(tx.phase);
  const locked = busy || unresolved || !!review;
  let content: Content | null = null; let contentError = '';
  try { content = mode === 'text' ? textContent(text) : image; } catch (e) { contentError = friendlyError(e); }
  async function refresh(current: Account = account) {
    if (!session) return;
    const version = ++refreshVersion.current;
    try {
      await session.ready();
      const [a, b, collection] = await Promise.all([session.balance('A'), session.balance('B'), listAssets(session, current)]);
      if (version !== refreshVersion.current) return;
      setWallets({ A: a, B: b }); setAssets(collection); setReady(true);
      setSelected(old => old ? collection.find(a => a.id === old.id) || null : null);
    } catch (e) { if (version === refreshVersion.current) { setReady(false); setAssets([]); setError(friendlyError(e)); } }
  }
  useEffect(() => { void refresh(account); return () => { refreshVersion.current++; }; }, [account, session]);
  function updateStatus(next: TxStatus) {
    setTx(old => { const merged = { account: old?.account, id: old?.id, ...next }; if (merged.hash) { try { localStorage.setItem('week07-tx', JSON.stringify({ ...merged, genesis: session?.config.genesis })); } catch {} } return merged; });
  }
  async function perform(action: () => Promise<void>) {
    if (actionLock.current) return; actionLock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(friendlyError(e)); setTx(old => old?.hash && ['pending','submitted','confirming','committed'].includes(old.phase) ? old : { phase: 'failed', message: friendlyError(e) }); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function buildMint() {
    if (!session || !content) return;
    const exactContent = content;
    await perform(async () => { updateStatus({ phase: 'building', account }); const built = await prepareMint(session, account, exactContent); setReview(built); updateStatus({ phase: 'review', account, id: built.id }); });
  }
  async function buildTransfer() {
    if (!session || !selected) return;
    await perform(async () => { updateStatus({ phase: 'building', account }); const built = await prepareTransfer(session, account, selected, recipient); setReview(built); updateStatus({ phase: 'review', account, id: built.id }); });
  }
  async function sign() {
    if (!session || !review) return;
    const captured = review;
    await perform(async () => {
      const hash = await submitReview(session, captured, updateStatus); setReview(null);
      const phase = await confirm(session, hash, updateStatus);
      if (phase === 'committed') {
        // Query both wallets after commitment, independent of the active collection.
        const [a, b] = await Promise.all([listAssets(session, 'A'), listAssets(session, 'B')]);
        await verifyOwnerAndContent(session, captured.id, captured.to, captured.content);
        if (captured.kind === 'transfer' && (captured.to !== captured.from && (captured.account === 'A' ? a : b).some(x => x.id === captured.id))) throw new Error('Committed; ownership index has not updated yet. Refresh to verify.');
        setNotice(captured.kind === 'mint' ? 'NFT created. Content bytes verified from the chain.' : 'Transfer committed. Both demo collections refreshed; the Spore ID and content are preserved.');
        await refresh(captured.account);
      }
    });
  }
  async function recheck() {
    if (!session || !tx?.hash) return; const hash = tx.hash;
    await perform(async () => { await session.ready(); if (await confirm(session, hash, updateStatus, 15000) === 'committed') { await refresh(); setNotice('Transaction committed. Collection refreshed from chain.'); } });
  }
  return <div className="shell">
    <header><a className="brand" href="#"><span className="brand-icon">◈</span><span>CKB NFT Minter<small>WEEK07 / DIGITAL OBJECTS</small></span></a><span className="badge">Devnet — Demo accounts</span></header>
    <main><section className="intro"><div><p className="eyebrow">MAKE SOMETHING PERMANENT</p><h1>Your ideas.<br/><em>On the chain.</em></h1><p className="lead">Turn a few words or a small image into a digital object on Nervos CKB. Create it, keep it, or pass it on.</p></div><aside className="intro-note"><span>01 — CREATE</span><span>02 — COLLECT</span><span>03 — TRANSFER</span><p>Original bytes. Immutable content.<br/>Powered by Spore Protocol.</p></aside></section>
      <section className="wallet panel"><div className="wallet-top"><div><p className="eyebrow">YOUR DEMO WALLET</p><h2>Account {account}</h2></div><div className="wallet-actions"><span className={`network ${ready ? 'online' : ''}`}>● {ready ? 'Node ready' : 'Node unavailable'}</span><div className="segmented">{(['A','B'] as const).map(a => <button key={a} className={account === a ? 'active' : ''} disabled={locked} onClick={() => { setSelected(null); setReview(null); setAssets([]); setAccount(a); }}>Account {a}</button>)}</div><button className="secondary" disabled={busy} onClick={() => { setError(''); void refresh(); }}>↻ Refresh</button></div></div>
        {wallet && <><CopyValue value={wallet.address}/><div className="balances"><div><small>Total live capacity</small><strong>{formatCkb(wallet.total)} <span>CKB</span></strong></div><div><small>Spendable plain-cell capacity</small><strong>{formatCkb(wallet.spendable)} <span>CKB</span></strong></div><div><small>Occupied cell storage</small><strong>{formatCkb(wallet.occupied)} <span>CKB</span></strong></div></div><p className="muted tiny">Spendable capacity excludes typed/data cells. A change cell must retain its minimum capacity; network fees are separate.</p></>}
        {!wallet && <p className="muted">Start OffCKB, run <code>pnpm configure</code>, then restart the app. These demo accounts are public and disposable.</p>}
      </section>
      {error && <div role="alert" className="alert error">{error}</div>}{notice && <div role="status" className="alert success">{notice}</div>}
      <div className="workspace"><section className="panel create"><div className="section-heading"><span className="step">01</span><div><h2>Create an NFT</h2><p className="muted">A small piece of you, stored on CKB.</p></div></div>
        <fieldset disabled={locked}><div className="segmented wide"><button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Tt &nbsp; Text</button><button className={mode === 'image' ? 'active' : ''} onClick={() => setMode('image')}>▧ &nbsp; Image</button></div>
        {mode === 'text' ? <label>Your words<textarea value={text} onChange={e => setText(e.target.value)} placeholder="What would you like to preserve?" rows={5}/><small className="muted">{new TextEncoder().encode(text).length} / 2048 UTF-8 bytes</small></label> : <label className="file-picker">Choose a PNG or JPEG<input type="file" accept="image/png,image/jpeg" onChange={e => { const file = e.target.files?.[0]; const version = ++fileVersion.current; setImage(null); setFileName(''); setError(''); if (file) void imageContent(file).then(result => { if (version === fileVersion.current) { setImage(result); setFileName(file.name); } }).catch(err => { if (version === fileVersion.current) setError(friendlyError(err)); }); }}/><small className="muted">Original file bytes · 20 KiB maximum{fileName && ` · ${fileName}`}</small></label>}
        </fieldset><div className="preview"><p className="eyebrow">EXACT CONTENT PREVIEW {content && `· ${content.bytes.length} BYTES`}</p>{content ? <ContentPreview content={content}/> : <p className="muted">{mode === 'text' && text ? contentError : 'Your content will appear here.'}</p>}</div>
        <p className="immutable">◇ Content is immutable after creation. Transferring changes its owner, never its contents.</p><button className="primary full" disabled={!ready || !content || locked} onClick={() => void buildMint()}>Review creation <span>↗</span></button>
      </section>
      <section className="panel collection"><div className="section-heading"><span className="step">02</span><div><h2>My Collection <span className="count">{assets.length}</span></h2><p className="muted">Live Spores owned by account {account}.</p></div></div>
        {!assets.length ? <div className="empty"><div>◈</div><h3>{ready ? 'A place for your originals' : 'Waiting for your local chain'}</h3><p className="muted">{ready ? 'Create your first NFT. It will appear here after the transaction is committed.' : 'Connect to OffCKB to read the collection.'}</p></div> : <div className="asset-grid">{assets.map(asset => <button key={asset.id} className={`asset ${selected?.id === asset.id ? 'chosen' : ''}`} disabled={locked} onClick={() => { setSelected(asset); setRecipient(wallets[account === 'A' ? 'B' : 'A']?.address || ''); }}><ContentPreview content={asset}/><div className="asset-caption"><strong>{asset.contentType.startsWith('text/plain') ? 'Text original' : 'Image original'}</strong><span>{asset.id.slice(0,12)}… ↗</span></div></button>)}</div>}
      </section></div>
      {selected && <section className="panel detail"><div className="section-heading"><span className="step">03</span><div><h2>NFT detail & transfer</h2><p className="muted">Send this same Spore to its next owner.</p></div></div><div className="detail-grid"><div><ContentPreview content={selected}/><p>{selected.contentType} · {selected.bytes.length} bytes · {formatCkb(selected.capacity)} CKB</p><details><summary>On-chain details</summary><p>Spore ID</p><CopyValue value={selected.id}/><p>Current owner</p><CopyValue value={selected.owner}/><p>Current live OutPoint (latest ownership transaction, not necessarily creation)</p><CopyValue value={`${selected.outPoint.txHash}:${selected.outPoint.index}`}/></details></div><div><label>Recipient address<input value={recipient} disabled={locked} onChange={e => setRecipient(e.target.value)} placeholder="ckt1…"/></label><button className="secondary" disabled={locked} onClick={() => setRecipient(wallets[account === 'A' ? 'B' : 'A']?.address || '')}>Use account {account === 'A' ? 'B' : 'A'}</button><p className="muted">The recipient receives the existing NFT with the same ID and bytes.</p><button className="primary" disabled={!ready || locked || !recipient.trim()} onClick={() => void buildTransfer()}>Review transfer ↗</button></div></div></section>}
      {tx && <section className="panel tx-status" aria-live="polite"><div><p className="eyebrow">TRANSACTION {tx.account && `· ACCOUNT ${tx.account}`}</p><h3>{tx.phase.charAt(0).toUpperCase() + tx.phase.slice(1)}</h3>{tx.message && <p>{tx.message}</p>}</div>{tx.hash && <><CopyValue value={tx.hash}/><button className="secondary" disabled={busy} onClick={() => void recheck()}>Recheck confirmation</button></>}</section>}
      <footer><span>CKB NFT Minter · Trung Do · Week07</span><span>Educational Devnet demo / Spore Protocol</span></footer>
    </main>
    {review && <div className="modal-backdrop"><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="review-title"><p className="eyebrow">CHECK BEFORE YOU SIGN</p><h2 id="review-title">Review {review.kind === 'mint' ? 'creation' : 'transfer'}</h2><ContentPreview content={review.content}/><p>{review.content.contentType} · {review.content.bytes.length} bytes · Account {review.account}</p><dl><dt>NFT occupied capacity</dt><dd>{formatCkb(review.capacity)} CKB</dd><dt>Network fee (prepared transaction)</dt><dd>{formatCkb(review.fee)} CKB</dd><dt>{review.kind === 'mint' ? 'Capacity + fee' : 'Additional sender cost (fee)'}</dt><dd>{formatCkb(review.kind === 'mint' ? review.capacity + review.fee : review.fee)} CKB</dd><dt>Sender change output</dt><dd>{formatCkb(review.change)} CKB</dd></dl><details open><summary>Owner / recipient</summary><p>From</p><CopyValue value={review.from}/><p>To</p><CopyValue value={review.to}/></details><p className="immutable">{review.kind === 'mint' ? 'These exact bytes will be permanent. Capacity is locked in the NFT; the network fee is spent.' : 'Ownership changes. The original ID and immutable content stay the same.'}</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => { setReview(null); setTx(null); }}>Cancel</button><button autoFocus className="primary" disabled={busy} onClick={() => void sign()}>{busy ? 'Processing…' : 'Confirm & sign'}</button></div></section></div>}
  </div>;
}
