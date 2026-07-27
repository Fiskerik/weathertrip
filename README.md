# Weathertrip

Weathertrip helps people plan trips around the weather. This MVP contains an iOS-first Expo app, a Vercel-ready web app, a TypeScript recommendations API, and shared trip/scoring logic.

## Workspace

- `apps/mobile` - Expo React Native app for the App Store/TestFlight slice.
- `apps/web` - Next.js planning UI prepared for Vercel.
- `services/api` - TypeScript API with `POST /recommendations`.
- `packages/shared` - shared destination data, trip types, presets, validation, and scoring.

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

The apps expect the API at `http://localhost:4100` by default. Override with `NEXT_PUBLIC_WEATHERTRIP_API_URL` for web or `EXPO_PUBLIC_WEATHERTRIP_API_URL` for Expo.

## Checks

```bash
npm run check
npm run build
npm --workspace @weathertrip/api run smoke
```

## MVP Notes

- Forecasts are fetched by the backend from Open-Meteo.
- Destinations are curated static data for Scandinavia and Central Europe.
- The mobile bundle ID is `com.eaconsulting.weathertrip`.
- Codemagic has a starter iOS TestFlight workflow in `codemagic.yaml`.
- Vercel can target `apps/web` for the web UI.
