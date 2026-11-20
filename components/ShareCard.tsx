'use client';
import { useState } from 'react';

export default function ShareCard({ teamName, caption }: { teamName: string; caption: string }) {
  const [fmt, setFmt] = useState<'post' | 'story'>('post');
  const [msg, setMsg] = useState('');
  const src = `/api/share-card?format=${fmt}`;
  async function share() {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `STEM-Fusion-${fmt}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text: caption }); return; }
      setMsg('Sharing is not supported on this device. Use Download, then post the image.');
    } catch { /* cancelled */ }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(caption); setMsg('Caption copied. Paste it in your post.'); } catch { setMsg('Could not copy. Select the caption text manually.'); }
  }
  return (
    <div className="card share-card">
      <div className="share-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={fmt} src={src} alt={`Share card for ${teamName}`} style={{ aspectRatio: fmt === 'post' ? '1 / 1' : '9 / 16' }} />
      </div>
      <div>
        <h3 style={{ marginTop: 0 }}>Share on social media</h3>
        <p className="small mut">Your team card is ready for Instagram, LinkedIn, WhatsApp status and Facebook. It updates with your marks and rank as results come in.</p>
        <p>
          <button type="button" className={fmt === 'post' ? '' : 'ghost'} onClick={() => setFmt('post')}>Post (square)</button>{' '}
          <button type="button" className={fmt === 'story' ? '' : 'ghost'} onClick={() => setFmt('story')}>Story / Status (9:16)</button>
        </p>
        <p>
          <a className="btn gold" href={`${src}&dl=1`} download>Download for social media</a>{' '}
          <button type="button" onClick={share}>Share</button>{' '}
          <button type="button" className="ghost" onClick={copy}>Copy caption</button>
        </p>
        <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{caption}</p>
        {msg && <p className="small mut" role="status">{msg}</p>}
      </div>
    </div>
  );
}
