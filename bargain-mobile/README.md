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
| `app/index.tsx` | boot router — onboarding flag → login → tabs |
| `app/onboarding.tsx` | 3 slides, once per install |
| `app/login.tsx` | `POST /api/v1/auth/{login,register,forgot-password}` |
| `app/(tabs)/index.tsx` | `GET /api/v1/arbitrage/deals/public` + `…/public-retailers` (public — guests can browse) |
| `app/deal/[id].tsx` | `GET …/deals/public/{id}`, click-out via `POST /api/v1/affiliate/click[/public]` |
| `app/(tabs)/saved.tsx` | `GET/POST/DELETE /api/v1/watchlist` + `…/{id}/refresh` (authed) |
| `app/(tabs)/profile.tsx` | `GET/PUT /api/v1/auth/me`, `GET/PUT …/me/niches` (authed) |

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
