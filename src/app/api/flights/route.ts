import { cheapestFlights } from "@/lib/providers/flights";

/** GET /api/flights?lat=..&lng=..&oneWay=0|1&month=YYYY-MM&nonstop=0|1 */
export async function GET(request: Request) {
  const token = process.env.TRAVELPAYOUTS_TOKEN?.trim();
  if (!token) {
    return Response.json(
      { error: "Flight search isn't set up yet. Add a free TRAVELPAYOUTS_TOKEN to .env.local (see SETUP.md), then restart WANDER.", setup: true },
      { status: 501 },
    );
  }
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ error: "lat and lng are required" }, { status: 400 });
  const month = sp.get("month") ?? undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: "month must be YYYY-MM" }, { status: 400 });
  try {
    const result = await cheapestFlights(
      lat,
      lng,
      { oneWay: sp.get("oneWay") === "1", month, nonstop: sp.get("nonstop") === "1", today: new Date().toISOString().slice(0, 10) },
      token,
    );
    return Response.json(result);
  } catch (e) {
    console.error("[wander] flight search failed:", String(e));
    const auth = /40[13]/.test(String(e));
    return Response.json(
      { error: auth ? "The flight data service rejected the TRAVELPAYOUTS_TOKEN. Double-check it in .env.local." : "The flight data service isn't responding right now. Try again in a minute." },
      { status: 502 },
    );
  }
}
