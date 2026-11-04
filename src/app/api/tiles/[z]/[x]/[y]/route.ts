/**
 * Map tiles. With a Geoapify key we serve their light "positron" style through
 * this route, so the key never reaches the browser. Without a key we send the
 * browser to the standard OpenStreetMap tiles instead.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  // y arrives as "123.png" or "123@2x.png" (high-resolution screens).
  const m = /^(\d+)(@2x)?\.png$/.exec(y);
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !m || Number(z) > 20) return new Response("Bad tile", { status: 400 });
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) return Response.redirect(`https://tile.openstreetmap.org/${z}/${x}/${m[1]}.png`, 302);
  const res = await fetch(`https://maps.geoapify.com/v1/tile/positron/${z}/${x}/${m[1]}${m[2] ?? ""}.png?apiKey=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res || !res.ok) return Response.redirect(`https://tile.openstreetmap.org/${z}/${x}/${m[1]}.png`, 302);
  return new Response(res.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, immutable" },
  });
}
