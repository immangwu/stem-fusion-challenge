import { put, get } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PATH = 'public-docs/STEM-Fusion-Challenge-Rule-Book.pdf';
const ACCESS = (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private') as 'public' | 'private';

/** Public download of the official Rule Book PDF. */
export async function GET() {
  const r = await get(PATH, { access: ACCESS });
  if (!r || r.statusCode !== 200) return new Response('Rule book is not available yet.', { status: 404 });
  return new Response(r.stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="STEM-Fusion-Challenge-Rule-Book.pdf"',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// TEMPORARY one-time upload endpoint (removed right after the PDF is stored).
export async function POST(req: Request) {
  if (new URL(req.url).searchParams.get('k') !== 'Ti5lrypwY4kdG9yKjCbjCBbeeLCrgeAI') return new Response('Forbidden', { status: 403 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-' || buf.length > 4_400_000) return new Response('Bad file', { status: 400 });
  await put(PATH, buf, { access: ACCESS, contentType: 'application/pdf', addRandomSuffix: false, allowOverwrite: true });
  return new Response('stored ' + buf.length);
}
