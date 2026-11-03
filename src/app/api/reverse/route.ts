import { cached } from "@/lib/cache";
import { reverseGeocode } from "@/lib/providers/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ error: "lat and lng required" }, { status: 400 });
  try {
    const result = await cached(`rev:${lat.toFixed(3)},${lng.toFixed(3)}`, 86400000, () => reverseGeocode(lat, lng));
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
