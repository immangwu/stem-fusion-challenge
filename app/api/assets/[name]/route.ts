import { put, get } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ACCESS = (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private') as 'public' | 'private';
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const ok = (n: string) => /^[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)$/i.test(n);

/** Public site images (logos, photos). */
export async function GET(_r: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!ok(name)) return new Response('Not found', { status: 404 });
  const r = await get('site-assets/' + name, { access: ACCESS });
  if (!r || r.statusCode !== 200) return new Response('Not found', { status: 404 });
  return new Response(r.stream, {
    headers: { 'Content-Type': TYPES[name.split('.').pop()!.toLowerCase()], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}

// TEMPORARY one-time upload endpoint (removed after the images are stored).
export async function POST(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (new URL(req.url).searchParams.get('k') !== 'QknRgKlD8JbCxILOzihFWgG4xE0vbsaN' || !ok(name)) return new Response('Forbidden', { status: 403 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 4_000_000 || buf.length < 100) return new Response('Bad file', { status: 400 });
  await put('site-assets/' + name, buf, { access: ACCESS, contentType: TYPES[name.split('.').pop()!.toLowerCase()], addRandomSuffix: false, allowOverwrite: true });
  return new Response('stored ' + buf.length);
}
