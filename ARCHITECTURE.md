# WeatherTrip — iOS App Architecture & Build Plan

A weather-optimized travel recommender: user sets dates, travel mode/time budget,
accommodation type, and weather preferences (sliders) → app returns ranked
destinations and multi-stop routes across Scandinavia + Central Europe, with
day-by-day weather scoring. Shipped as a native-feeling iOS app on the App Store,
built and released via Codemagic + GitHub.

---

## 1. Product Scope (v1)

**In scope**
- Single start location (GPS or manual search)
- Fixed or flexible date window ("leave tomorrow", "back by Y", "10 days")
- Travel mode: Car / Train / Flight, with max hours/day
- Min/max consecutive days per stop
- Accommodation tag filter: Tent / Trailer / Hotel / Hostel / Cabin / Glamping
- Weather preference sliders: temp range, max precipitation %, min sunshine hours, wind tolerance
- Optional soft budget filter
- Output: ranked destinations + 1–3 stop suggested route, map view, weather score, "why this place"
- Localization: EN, SV, DE, DA, NO, FI (6 languages)
- Geographic focus: Scandinavia + Central Europe only

**Out of scope for v1**
- Real-time accommodation pricing/availability
- Payments/booking
- Push notifications
- Multi-modal mixed itineraries (car+train same trip)

---

## 2. Why Native iOS Instead of the Web Stack

The original plan assumed a Next.js web app. Since the target is the **App Store**
via **Codemagic**, the recommended approach is a single cross-platform codebase
that compiles to a real iOS binary, not a wrapped website — App Review penalizes
thin WebViews, and Codemagic is built around native/Flutter/React Native builds.

| Layer | Recommendation | Why |
|---|---|---|
| App framework | **React Native (Expo, Dev Client / "bare" workflow)** | Reuses React/TypeScript knowledge from the original web plan; huge library ecosystem; Codemagic has first-class Expo/RN support; easy path to Android later |
| Alternative | Flutter | Also excellent Codemagic support, better raw performance, but throws away the React/TS knowledge already invested in the web plan — pick this only if the team prefers Dart |
| Language | TypeScript | Type safety across app + shared logic |
| Navigation | React Navigation (native-stack) | Standard, App-Store-safe navigation patterns |
| State | Zustand or Redux Toolkit | Simple global state for trip form + results |
| Styling/UI | Tamagui or NativeWind (Tailwind for RN) + custom design system | Matches the Tailwind/shadcn direction from the web plan |
| Maps | `react-native-maps` (Apple Maps/Google Maps) or Mapbox RN SDK | Native map rendering, clustering, route polylines |
| i18n | `i18next` + `react-i18next` + `expo-localization` | Same mental model as `next-intl`, works in RN |
| Weather | **Open-Meteo** (primary, free, no key needed for non-commercial) | 16-day hourly/daily forecast, matches original plan exactly |
| Geocoding/Places | Geoapify or Mapbox Geocoding | Free/cheap location search & reverse geocoding |
| Travel time | OSRM (self-hosted or public demo server) for car; static distance/speed heuristics for train/flight in v1 | Keeps backend simple for MVP |
| Backend | **FastAPI (Python)** or **NestJS (TypeScript)**, containerized | Owns caching, scoring algorithm, route optimization — keeps API keys and heavy compute off-device |
| Database | PostgreSQL + PostGIS (Supabase is a fast way to get both + auth) | Store candidate destinations, cached forecasts, saved trips |
| Auth (v1.1+) | Supabase Auth or Clerk | Only needed once "saved trips" ships |
| Backend hosting | Railway or Fly.io | Cheap, simple, good Postgres/PostGIS support |
| CI/CD | **Codemagic** | Builds, signs, and ships the iOS binary to TestFlight/App Store |
| Source control | **GitHub** | Codemagic connects directly via GitHub App integration |
| Crash/analytics | Sentry + PostHog (or Firebase) | Needed before real users hit production |

> Everything below assumes React Native + Expo. If Flutter is chosen instead, the
> mobile-side folder structure and libraries change, but the backend, weather
> scoring engine, CI/CD flow, and App Store steps stay identical.

---

## 3. High-Level Architecture

```
┌─────────────────────────────┐
│        iOS App (RN)         │
│  ─────────────────────────  │
│  Trip Input Form (sliders,   │
│  dates, mode, accommodation) │
│  Results List + Map View     │
│  i18n layer (6 languages)    │
└───────────────┬──────────────┘
                │ HTTPS (REST/JSON)
                ▼
┌─────────────────────────────┐
│        Backend API           │
│  (FastAPI or NestJS)         │
│  ─────────────────────────  │
│  /candidates  → find nearby  │
│  /score       → weather score│
│  /route       → multi-stop   │
│  Caching layer (Redis/PG)    │
└───────┬───────────┬──────────┘
        │           │
        ▼           ▼
┌───────────────┐ ┌────────────────┐
│  Open-Meteo    │ │ Geocoding/OSRM │
│  (forecasts)   │ │ (places/routes)│
└───────────────┘ └────────────────┘
        │
        ▼
┌─────────────────────────────┐
│   PostgreSQL + PostGIS       │
│   (destinations, cache,      │
│    saved trips - v1.1)       │
└─────────────────────────────┘
```

**Design principle:** the mobile app is a thin client. It never calls Open-Meteo
or OSRM directly — the backend owns scoring, caching, and route logic. This keeps
the recommendation algorithm private, makes it easy to tune scoring without an
App Store release, and avoids rate-limit issues on-device.

---

## 4. Recommendation Engine (Backend Logic)

1. **Generate candidates** — radius = `max_hours_per_day × travel_days × mode_speed`,
   filtered to the Scandinavia + Central Europe bounding region.
2. **For each candidate + feasible date window:**
   - Fetch/cache Open-Meteo forecast for the period.
   - Compute `weather_score` (weighted: temperature closeness, precipitation, sunshine, wind).
   - Check `travel_feasibility` against mode + max hours/day.
   - Validate `stay_length` fits within min/max consecutive days.
   - Score `accommodation_fit` (e.g., campsite density for Tent/Trailer).
3. **Composite score** = `weather_score × travel_feasibility × accommodation_fit × budget_fit`.
4. **Cluster** nearby high-scoring candidates into 1–3 stop itineraries respecting stay-length rules.
5. **Cache aggressively** — forecasts keyed by `(lat, lon, date)`, re-score only on input change, not on every request.

---

## 5. Localization Plan

- 6 languages: `en`, `sv`, `de`, `da`, `no`, `fi`
- JSON message catalogs per language via `i18next`
- Destination names/descriptions: start with a translation layer (DeepL/Google
  Translate API) over Wikipedia/OSM data; hand-correct top ~50 destinations at launch
- Locale-aware date formats, `°C`/`°F` toggle, number formatting
- App Store metadata (name, subtitle, screenshots, keywords) localized per market too — this is a separate App Store Connect task, not just in-app strings

---

## 6. Suggested Repo Structure

```
weathertrip/
├── apps/
│   └── mobile/                 # React Native (Expo) app
│       ├── app/                 # screens (expo-router) or /src/screens
│       ├── src/
│       │   ├── components/
│       │   ├── i18n/            # locale JSON files
│       │   ├── state/           # Zustand/Redux store
│       │   └── api/             # typed client for backend
│       ├── ios/                 # native project (generated/prebuilt)
│       ├── app.json / app.config.ts
│       └── package.json
├── services/
│   └── api/                     # FastAPI or NestJS backend
│       ├── src/
│       │   ├── routers/         # /candidates /score /route
│       │   ├── scoring/         # weather scoring engine
│       │   ├── clients/         # Open-Meteo, Geocoding, OSRM clients
│       │   └── db/               # models, migrations
│       └── Dockerfile
├── codemagic.yaml               # CI/CD config
└── docs/
    └── ARCHITECTURE.md          # this file
```

---

## 7. Step-by-Step Build Plan

### Phase 0 — Setup (Week 1)
- [ ] Create GitHub org/repo, set up branch protection (`main` protected, PRs required)
- [ ] Apple Developer Program enrollment ($99/yr) — required before any TestFlight/App Store step
- [ ] Create App Store Connect record (bundle ID, app name reservation)
- [ ] Scaffold RN app with Expo (`npx create-expo-app`)
- [ ] Scaffold backend service (FastAPI/NestJS) + Dockerfile
- [ ] Provision Postgres (Supabase or Railway) + enable PostGIS
- [ ] Connect repo to Codemagic, add `codemagic.yaml`

### Phase 1 — Core MVP (Weeks 2–5)
- [ ] Trip input form: start location (GPS + search), date window, duration
- [ ] Car-only mode, max hours/day input
- [ ] Weather sliders: temperature range, precipitation
- [ ] Backend `/candidates` + `/score` endpoints using Open-Meteo
- [ ] Results list screen + basic map view (top 5–10 destinations)
- [ ] i18n scaffolding with EN + SV live
- [ ] Internal TestFlight build via Codemagic

### Phase 2 — Route + Filters (Weeks 6–9)
- [ ] Train/flight mode (heuristic travel-time estimates)
- [ ] Min/max stay-days constraint + multi-stop clustering (`/route`)
- [ ] Accommodation type filter
- [ ] Remaining 4 languages (DE, DA, NO, FI)
- [ ] Soft budget slider
- [ ] Polish map (route polylines, stop markers, day-by-day weather summary per stop)

### Phase 3 — App Store Launch Prep (Weeks 10–11)
- [ ] App icon, launch screen, screenshots (per locale) per App Store guidelines
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) — required by Apple for RN/Expo apps that use tracking-adjacent APIs
- [ ] App Store privacy "nutrition label" answers (location data usage, etc.)
- [ ] Crash/analytics SDK wired in (Sentry/PostHog)
- [ ] Codemagic pipeline: automatic TestFlight → App Store submission publish step
- [ ] Beta test via TestFlight (external group)
- [ ] Submit for App Review

### Phase 4+ — Post-launch
- [ ] User accounts + saved trips (Supabase Auth)
- [ ] "Leave tomorrow" one-tap mode
- [ ] Real accommodation/campsite data integration
- [ ] Push notifications for weather changes on saved trips
- [ ] Android release (React Native pays off here — same codebase)

---

## 8. Codemagic + GitHub CI/CD Setup

1. **Connect repo**: Codemagic → "Add application" → authorize the GitHub App → select `weathertrip` repo.
2. **Signing**: Use Codemagic's automatic iOS code signing (recommended) — it manages
   certificates/provisioning profiles via App Store Connect API key, no manual `.p12` handling.
   - Generate an App Store Connect API key in App Store Connect → Users and Access → Integrations.
   - Add it as an encrypted environment variable group in Codemagic (`app_store_credentials`).
3. **`codemagic.yaml`** (example skeleton):

```yaml
workflows:
  ios-release:
    name: iOS Release
    max_build_duration: 60
    environment:
      groups:
        - app_store_credentials
      vars:
        XCODE_WORKSPACE: "mobile.xcworkspace"
        XCODE_SCHEME: "mobile"
      node: 20
      xcode: latest
      cocoapods: default
    triggering:
      events:
        - push
      branch_patterns:
        - pattern: main
          include: true
    scripts:
      - name: Install npm dependencies
        script: cd apps/mobile && npm ci
      - name: Prebuild (Expo)
        script: cd apps/mobile && npx expo prebuild -p ios
      - name: Install CocoaPods
        script: cd apps/mobile/ios && pod install
      - name: Set up code signing
        script: xcode-project use-profiles
      - name: Build ipa
        script: |
          xcode-project build-ipa \
            --workspace apps/mobile/ios/$XCODE_WORKSPACE \
            --scheme $XCODE_SCHEME
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
        submit_to_app_store: false   # flip to true once you're ready for full review
```

4. **Backend CI**: separate simple workflow (GitHub Actions is fine here) to build/push
   the Docker image to Railway/Fly.io on push to `main`.
5. **Environments**: keep `staging` and `production` API URLs as build-time env vars in
   the RN app config so TestFlight builds hit staging, App Store builds hit production.

---

## 9. Apple-Specific Requirements Checklist

- Apple Developer Program membership (individual or org — org needed for a company name on the App Store)
- App privacy details completed in App Store Connect (location, and any analytics data collected)
- `PrivacyInfo.xcprivacy` manifest declaring required-reason API usage (common gap for RN apps using AsyncStorage, etc.)
- Location permission strings (`NSLocationWhenInUseUsageDescription`) with clear, honest copy
- App icon set + at least one iPhone screenshot set per supported display size
- Support URL + privacy policy URL (public webpage, can be a simple hosted markdown/HTML page)
- TestFlight beta review passed before wide external testing
- App Review guidelines: avoid placeholder/lorem-ipsum content, ensure all sliders/buttons are functional in the reviewed build

---

## 10. Open Questions to Resolve Before Phase 0

- React Native vs Flutter — final call?
- FastAPI vs NestJS for backend — team's stronger language?
- Supabase (managed Postgres+Auth+PostGIS in one) vs separate Railway Postgres + custom auth later?
- Individual Apple Developer account or a company/org account?
