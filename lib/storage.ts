import { put, get } from '@vercel/blob';

const ACCESS = (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private') as 'public' | 'private';

export async function saveBlob(path: string, data: Buffer, contentType: string) {
  const r = await put(path, data, { access: ACCESS, contentType, addRandomSuffix: true });
  return r.pathname;
}

export async function readBlob(pathname: string) {
  const r = await get(pathname, { access: ACCESS });
  if (!r || r.statusCode !== 200) return null;
  return r;
}

export async function readBlobBuffer(pathname: string): Promise<Buffer | null> {
  const r = await readBlob(pathname);
  if (!r) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}
