/** CSRF defence for route handlers: a browser always sends Origin on cross-site POSTs. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') || req.headers.get('host'));
  } catch {
    return false;
  }
}

export function back(req: Request, path: string, kind: 'msg' | 'err', text: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return Response.redirect(`${proto}://${host}${path}?${kind}=${encodeURIComponent(text)}`, 303);
}
