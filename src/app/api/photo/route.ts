import { cached } from "@/lib/cache";
import { USER_AGENT } from "@/lib/providers/osm";

/**
 * Looks up a real photo of a city or landmark from Wikipedia (free, no key).
 * Returns null when there isn't one; the UI falls back to a gradient.
 */
export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim();
  if (!title) return Response.json({ photo: null });
  try {
    const photo = await cached(`photo:${title}`, 7 * 86400000, async () => {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { originalimage?: { source: string }; thumbnail?: { source: string }; content_urls?: { desktop?: { page?: string } } };
      const src = j.originalimage?.source ?? j.thumbnail?.source;
      if (!src) return null;
      return { url: src, credit: "Wikimedia Commons via Wikipedia", page: j.content_urls?.desktop?.page ?? null };
    });
    return Response.json({ photo }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ photo: null });
  }
}
