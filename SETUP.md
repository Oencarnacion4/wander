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

## 2. Turn on accounts with Supabase (free, about 10 minutes)

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

## 3. Optional settings

| Variable | What it does |
|---|---|
| `CONTACT_EMAIL` | Added to the User-Agent sent to OpenStreetMap, which their usage policy asks for. Recommended when you deploy. |
| `OVERPASS_URLS` | Comma-separated Overpass mirrors, if the defaults are slow. |
| `NOMINATIM_URL` | A different Nominatim server. |

No API keys are needed for places, maps, geocoding or photos.

## 4. Deploy (for the class demo)

1. At https://vercel.com, click **Add New → Project** and import the `wander` repo.
2. Add the same environment variables as `.env.local`, then click **Deploy**.
3. In Supabase, open **Authentication → URL Configuration** and set **Site URL** to your Vercel URL.
