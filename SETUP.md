# Setting up WANDER

## 1. Run it locally (5 minutes, no accounts needed)

Requires Node.js 20 or newer.

```bash
git clone https://github.com/Oencarnacion4/wander.git
cd wander
npm install
npm run dev
```

Open http://localhost:3000. Everything works in **guest mode**: places, maps, plans, Home Base and My Adventures are saved in your browser.

Run the tests:

```bash
npm test
```

## 2. Get a Geoapify key for fast place search (free, about 2 minutes)

Without a key, WANDER uses the free public OpenStreetMap servers. They are often busy and can time out. Geoapify serves the same OpenStreetMap places from a fast server.

1. Go to https://myprojects.geoapify.com and sign up. It's free and needs no credit card.
2. Click **Add new project** (or **Create project**), name it `wander`, and click **OK**.
3. Copy the **API key** that appears.
4. In the project folder, copy `.env.example` to `.env.local` (if you haven't already) and paste the key:
   ```
   GEOAPIFY_API_KEY=your-key-here
   ```
5. Stop the app (Ctrl + C) and run `npm run dev` again.

The free plan includes 3,000 credits a day. One search uses about 15–30, and repeat searches within 30 minutes are cached.

## 3. Turn on Cheapest flights (free, about 5 minutes)

Take Me Somewhere → **Cheapest flights** lists the cheapest fares from the airports near any location, to anywhere. Prices are real fares that Aviasales users found recently (each card says how long ago), and **Check price** opens Google Flights for the live price.

1. Sign up free at https://www.travelpayouts.com.
2. In the dashboard, open **Programs**, find **Aviasales**, and click **Join** (approval is instant for the data API).
3. Copy your API token from **Profile → API token** (https://app.travelpayouts.com/profile/api-token).
4. Add it to `.env.local`:
   ```
   TRAVELPAYOUTS_TOKEN=your-token
   ```
5. Restart `npm run dev`.

## 4. Turn on accounts with Supabase (free, about 10 minutes)

1. Go to https://supabase.com, sign up, and click **New project**. Pick any name and a database password, and choose the region closest to you.
2. When the project is ready, open **SQL Editor → New query**. Paste the whole contents of `supabase/migrations/0001_init.sql` and click **Run**. This creates the tables and security rules.
3. Open **Project Settings → API** (or **Connect → App frameworks**) and copy:
   - **Project URL**
   - **anon / publishable key** (*not* the service-role key)
4. In the project folder, copy `.env.example` to `.env.local` and paste the values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
5. Optional, for faster testing: **Authentication → Sign In / Providers → Email** → turn off **Confirm email**, so new accounts can sign in right away.
6. Restart `npm run dev`. The Home Base page now shows **Sign in / Create account**.

## 5. Optional settings

| Variable | What it does |
|---|---|
| `TRAVELPAYOUTS_TOKEN` | Cheapest flights (section 3). |
| `GEOAPIFY_API_KEY` | Fast, reliable place search (section 2). Strongly recommended. |
| `CONTACT_EMAIL` | Added to the User-Agent sent to OpenStreetMap, which their usage policy asks for. Recommended when you deploy. |
| `OVERPASS_URLS` | Comma-separated Overpass mirrors, if the defaults are slow. |
| `NOMINATIM_URL` | A different Nominatim server. |

Maps, geocoding and photos need no keys. Place search works without a key, but much more reliably with Geoapify.

## 6. Deploy to Vercel

1. At https://vercel.com, sign in with GitHub, click **Add New → Project**, and import the `wander` repository. Vercel detects Next.js automatically; leave the build settings as they are.
2. Before clicking **Deploy**, open **Environment Variables** and add (values from your `.env.local`):

   | Name | Secret? |
   |---|---|
   | `GEOAPIFY_API_KEY` | Yes: server only |
   | `TRAVELPAYOUTS_TOKEN` | Yes: server only |
   | `NEXT_PUBLIC_SUPABASE_URL` | No: public by design |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | No: public by design, data protected by row-level security |
   | `CONTACT_EMAIL` | Optional |

   Supabase values are baked in at build time: if you add or change them later, redeploy. Vercel drops the `NEXT_PUBLIC_` prefix from variables saved as "Secret" (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); WANDER accepts either name.
3. Click **Deploy**.
4. In Supabase, open **Authentication → URL Configuration** and set **Site URL** to your Vercel URL (also add it under **Redirect URLs**).
5. Every push to `main` redeploys automatically.
