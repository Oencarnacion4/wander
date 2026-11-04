import { cached } from "@/lib/cache";
import { geocode } from "@/lib/providers/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });
  const usOnly = searchParams.get("us") === "1";
  try {
    const results = await cached(`geo:${usOnly}:${q.toLowerCase()}`, 86400000, () => geocode(q, { usOnly }));
    return Response.json({ results });
  } catch (e) {
    console.error("[wander] location search failed:", String(e));
    return Response.json({ error: `Location search isn't responding right now (${String(e).replace(/^Error: /, "")}). Try again in a moment.` }, { status: 502 });
  }
}
