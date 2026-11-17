import { get } from '@vercel/blob';

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
