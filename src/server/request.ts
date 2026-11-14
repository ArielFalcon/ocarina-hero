export const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

/** The JSON body of a same-origin POST no larger than `maxBytes`, or the status to answer with. */
export async function readSameOriginJson(request: Request, maxBytes: number): Promise<{ body: unknown } | { status: number }> {
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return { status: 403 };
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) return { status: 413 };
  const text = await request.text();
  if (text.length > maxBytes) return { status: 413 };
  try { return { body: JSON.parse(text) }; } catch { return { status: 400 }; }
}
