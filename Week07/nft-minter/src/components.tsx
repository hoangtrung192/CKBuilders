import { useEffect, useState } from 'react';
import { checkDecodable, validateImageBytes, type Content } from './lib/validation';
export function ContentPreview({ content }: { content: Content }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true; let objectUrl = ''; setUrl('');
    if (['image/png','image/jpeg'].includes(content.contentType)) void (async () => {
      try {
        validateImageBytes(content.bytes, content.contentType); await checkDecodable(content.bytes, content.contentType);
        if (active) { objectUrl = URL.createObjectURL(new Blob([new Uint8Array(content.bytes)], { type: content.contentType })); setUrl(objectUrl); }
      } catch { /* Unsupported or invalid chain data gets a safe fallback. */ }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [content]);
  if (content.contentType.split(';')[0] === 'text/plain') return <pre className="text-preview">{new TextDecoder().decode(content.bytes)}</pre>;
  return url ? <img className="image-preview" src={url} alt="Exact NFT content"/> : <p className="muted">Unsupported or invalid image content.</p>;
}
export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-value"><code>{value}</code><button className="subtle" onClick={() => { void navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : 'Copy'}</button></div>;
}
