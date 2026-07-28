# Weathertrip

Weathertrip helps people plan simple European road trips around the weather. The current MVP contains an iOS-first Expo app, a Vercel-ready web app, a Docker-ready Express API, Supabase account/saved-trip routes, and shared planning logic.

## Workspace

- `apps/mobile` - Expo React Native app for the App Store/TestFlight slice.
- `apps/web` - Next.js planning UI prepared for Vercel.
- `services/api` - TypeScript API with `POST /v2/plans`, profile, and saved-trip routes.
- `packages/shared` - shared destination catalog, trip contracts, validation, break scheduling, and scoring.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build shared types before running apps:

   ```bash
   npm --workspace @weathertrip/shared run build
   ```

3. Start the recommendations API:

   ```bash
   npm run dev:api
   ```

4. In another terminal, start either UI:

   ```bash
   npm run dev:web
   npm run dev:mobile
   ```

The apps use `http://localhost:4100` only during development. Override `NEXT_PUBLIC_WEATHERTRIP_API_URL` for web or `EXPO_PUBLIC_WEATHERTRIP_API_URL` for Expo. Release builds fail unless the Expo API URL is a public HTTPS URL.

For the API, set `OPEN-METEO` and routing credentials only on the server when available. Supabase server values are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; the mobile app only receives `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Apply `services/api/supabase.sql` to the Supabase project before enabling cloud saves.

Railway can deploy `services/api/Dockerfile` from the repository root. Set its `PORT`/`WEATHERTRIP_API_PORT`, provider keys, and Supabase service credentials there. Add the generated Railway HTTPS domain and public Supabase values to the Codemagic environment group used by `ios-testflight`.

The TestFlight workflow requires these Codemagic variables: `EXPO_PUBLIC_WEATHERTRIP_API_URL` (for example, `https://weathertrip-api-production.up.railway.app`), `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. They must be added to an environment group attached to the `ios-testflight` workflow; do not put the real values in `codemagic.yaml` or commit them. The build intentionally stops when the API URL is missing, non-HTTPS, or local.

## Checks

```bash
npm run check
npm run build
npm --workspace @weathertrip/api run smoke
```

## MVP Notes

- Forecasts are fetched and cached by the backend from Open-Meteo.
- Destinations are curated static data for Northern, Western, and Central Europe.
- Guest saved trips use AsyncStorage; signed-in users can migrate them to Supabase.
- The plan response includes one map-first route and two alternatives when the brief has enough feasible choices.
- The mobile bundle ID is `com.eaconsulting.weathertrip`.
- Codemagic has a starter iOS TestFlight workflow in `codemagic.yaml`.
- Vercel can target `apps/web` for the web UI.
