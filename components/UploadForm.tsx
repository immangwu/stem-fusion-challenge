'use client';
import { useState } from 'react';

const LIMIT = 3.8 * 1024 * 1024;

/** Reads the chosen file into memory immediately (avoids ERR_UPLOAD_FILE_CHANGED on phones when the file
 *  comes from Drive / WhatsApp / camera), shrinks big photos, then posts with fetch. */
export default function UploadForm({ phase, kind, button, hint }: { phase: number; kind: 'pdf' | 'image'; button: string; hint?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [declare, setDeclare] = useState(false);
  const isImg = kind === 'image';

  async function pick(f: File | undefined) {
    setErr(''); setFile(null);
    if (!f) return;
    try {
      const buf = await f.arrayBuffer(); // snapshot now
      setFile(new File([buf], f.name, { type: f.type || (isImg ? 'image/jpeg' : 'application/pdf') }));
    } catch {
      setErr('Could not read that file. Save it to your phone storage (Downloads) and choose it again from there.');
    }
  }

  async function shrink(f: File): Promise<File> {
    if (f.size <= LIMIT) return f;
    const bmp = await createImageBitmap(f);
    let scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85 - i * 0.08));
      if (blob && blob.size <= LIMIT) return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      scale *= 0.8;
    }
    throw new Error('big');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!file) return setErr('Choose a file first.');
    if (isImg && !declare) return setErr('Please confirm the photo is real and not AI-generated.');
    setBusy(true);
    try {
      let f = file;
      if (isImg) f = await shrink(f);
      else if (f.size > LIMIT) { setBusy(false); return setErr('PDF is larger than 4 MB. Compress it (for example with iLovePDF) and try again.'); }
      const fd = new FormData();
      fd.set('phase', String(phase)); fd.set('kind', kind); fd.set('file', f);
      if (isImg) fd.set('declare', 'on');
      const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
      if (r.status === 413) throw new Error('413');
      if (r.redirected) { window.location.href = r.url; return; }
      window.location.reload();
    } catch (x) {
      setBusy(false);
      setErr((x as Error).message === 'big' || (x as Error).message === '413'
        ? 'File is too large. Choose a smaller file (max 4 MB).'
        : 'Upload failed. Check your internet and try again.');
    }
  }

  return (
    <form onSubmit={submit}>
      <input type="file" accept={isImg ? 'image/jpeg,image/png' : 'application/pdf'} onChange={(e) => pick(e.target.files?.[0])} required />
      {file && <div className="small mut">Selected: {file.name} ({(file.size / 1048576).toFixed(1)} MB)</div>}
      {isImg && (<label style={{ fontWeight: 400 }}><input type="checkbox" checked={declare} onChange={(e) => setDeclare(e.target.checked)} /> This is a real photo of our model, not AI-generated.</label>)}
      <button type="submit" disabled={busy}>{busy ? 'Uploading…' : button}</button> {hint && <span className="small mut">{hint}</span>}
      {err && <p className="err small" role="alert">{err}</p>}
    </form>
  );
}
