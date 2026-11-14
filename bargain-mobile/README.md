# bargain-mobile

BargainHuntrs — the deal-feed app. Expo SDK 56 + expo-router, dark-only,
built to the `clipstakes-mobile` fleet standard.

## Stack

- **API:** `https://api.bargainhuntrs.com` (bargain-api, FastAPI) — the same
  backend `bargain-web` calls. Base URL lives in `services/api.ts`.
- **Auth:** JWT pair in the OS keychain (`expo-secure-store`, AsyncStorage
  fallback). Access token is 1h; `services/auth.ts` auto-refreshes it with the
  14-day refresh token via `POST /api/v1/auth/refresh`.
- **IDs:** `com.bargainhuntrs.mobile` (iOS bundle + Android package),
  scheme `bargainhuntrs://`.

## Screens

| Route | What it calls |
|---|---|
| `app/index.tsx` | boot router — onboarding flag → login → tabs; biometric lock screen while gated |
| `app/onboarding.tsx` | 3 slides, once per install |
| `app/login.tsx` | `POST /api/v1/auth/{login,register,forgot-password}` |
| `app/(tabs)/index.tsx` | `GET /api/v1/arbitrage/deals/public` + `…/public-retailers` (public — guests can browse); AsyncStorage snapshot fallback offline |
| `app/deal/[id].tsx` | `GET …/deals/public/{id}`, click-out via `POST /api/v1/affiliate/click[/public]`, native share sheet |
| `app/(tabs)/saved.tsx` | `GET/POST/DELETE /api/v1/watchlist` + `…/{id}/refresh` (authed); snapshot fallback offline |
| `app/(tabs)/profile.tsx` | `GET/PUT /api/v1/auth/me`, `GET/PUT …/me/niches`, `GET/PUT …/notifications/preferences`, `POST/DELETE …/push/{register,unregister}`, `POST …/push/test` (authed) |

## Native features (Guideline 4.3 depth)

- **Biometric unlock** — opt-in per device; gate fires on cold start after a
  session restore (`services/biometrics.ts`, expo-local-authentication,
  toggle in Profile → Security & alerts).
- **Push deal alerts** — `services/push.ts` mints the native device token
  (`getDevicePushTokenAsync` — FCM on Android) and posts it to the real
  `POST /api/v1/notifications/push/register`; Profile toggle mirrors the
  server-side pref, test-push button fires `POST …/push/test`. Taps deep-link
  `data.url` → `/deal/<id>` (`wireNotificationHandlers` in `app/_layout.tsx`).
  Degrades honestly on builds without FCM wired.
- **Haptics** — `services/haptics.ts`, lazy-required; taps, chip switches,
  save/remove/success feedback.
- **Offline snapshots** — `services/cache.ts` AsyncStorage envelopes; feed,
  retailer list and watchlist render stale-labelled data when the API is
  unreachable.
- All native modules are lazy-required — an OTA landing on a binary built
  before they shipped degrades silently instead of crashing.

## Commands (pnpm only)

```bash
pnpm install                 # from repo root — workspace package
pnpm exec tsc --noEmit       # typecheck
pnpm exec expo export --platform ios
pnpm start                   # dev server
```

## Assets

`scripts/gen_app_icons.py` regenerates every icon/splash PNG from the site's
`logo.svg` (emerald tile + dark B⚡H). Needs any Python with Pillow:

```bash
python3 -m venv /tmp/iconenv && /tmp/iconenv/bin/pip install Pillow
/tmp/iconenv/bin/python scripts/gen_app_icons.py
```

## Notes

- No EAS cloud builds — `eas.json` exists for `--local` builds only.
- Signup requires an E.164 phone number (bargain-api enforces it); the app
  normalizes US input to `+1…` before posting.
- Deal links are affiliate links — the FTC disclosure sits on the deal
  detail screen, matching the site.
