# BargainHuntrs — Google Play submission packet

Expo RN app (expo-router): public deals feed with guest browse; sign-in
unlocks watchlist, alerts, Aura points and referrals. Data =
api.bargainhuntrs.com.

## Identity
- **App name:** BargainHuntrs
- **Package:** `com.bargainhuntrs.mobile`
- **Version:** 1.0.0 / versionCode 1 (pinned in `app.json` — bump manually
  for re-uploads; no EAS project linked yet)
- **EAS project:** none (`eas init` not run — local builds don't need it)
- **Developer entity:** Reid Technology
- **Category:** Shopping
- **Price:** Free

## Play record status
**No Play record** — the app record cannot be created via API; one manual
"Create app" step in Play Console (or headed-browser session; Google
rejects headless sign-in).

## Build (local only — EAS cloud is billing-gated)
```bash
cd bargain-mobile
# Preferred (EAS-managed remote keystore):
ANDROID_HOME=~/Library/Android/sdk GRADLE_USER_HOME=/Volumes/Os_Sites/tools/gradle \
  EXPO_USE_PNPM=1 eas build -p android --profile production --local \
  --output dist/bargain.aab --non-interactive
# Bare-gradle alternative (debug-signed — internal testing only):
#   npx expo prebuild -p android --clean && cd android && ./gradlew bundleRelease
#   → android/app/build/outputs/bundle/release/app-release.aab
#   Wire a release jks into signingConfigs.release before shipping it.
```
No release keystore exists locally yet — first EAS local build creates the
keystore on remote credentials (`eas credentials`).

## Submit (Android Publisher API)
```bash
node scripts/play-submit.mjs dist/bargain.aab
# SA key staged at ./credentials/android/play-store-service-account.json
# (gitignored — the shared eas-play-submit SA). Overrides: PACKAGE /
# PLAY_SA_KEY / TRACK / RELEASE_STATUS / RELEASE_NOTES / SKIP_LISTING.
```
Uploads the AAB, commits an **internal** track release, writes the en-US
listing, sets contact details (hello@bargainhuntrs.com), and uploads icon +
feature graphic from `assets/` when present.

## Console-side checklist (owner step — sign-in is owner-gated)
- [ ] Create app record — name `BargainHuntrs`, App, Free, default en-US
- [ ] `node scripts/play-submit.mjs dist/bargain.aab` (AAB + internal track
      + listing + contact in one shot)
- [ ] Content rating questionnaire (IARC)
- [ ] Data safety — email/name/phone collected; affiliate outbound links;
      encrypted in transit; no data sale
- [ ] Target audience: adults (deals/arbitrage — NOT for children)
- [ ] App access → reviewer creds from `docs/play-review/credentials.md`
      (guest browse also available)
- [ ] Store listing → `docs/store-listing.md`; screenshots + feature
      graphic 1024×500 + icon 512×512
- [ ] Privacy policy URL: https://bargainhuntrs.com/privacy (live, 200)

## Graphic assets (2026-11-12 — droid-assets)

- **Play hi-res icon:** `bargain-mobile/assets/play-icon-512.png` (512×512,
  downscaled from the 1024 app icon)
- **Feature graphic:** `bargain-mobile/assets/play-feature-1024x500.png`
  (1024×500 — dark brand card: mark + name + tagline, Settle/Prime recipe)
- **Phone screenshots (6, 1080×1920 9:16):** `bargain-mobile/screenshots/play/`
  — 01–03 onboarding (Find it underpriced / See the profit spread / Track any
  price), 04-login, 05-watchlist (guest), 06-profile. Captured from a real
  `expo export --platform web` render at phone viewport — real UI.
- RNW deps added for the export (react-native-web/react-dom/@expo/metro-runtime).
- Remaining: the live deals feed renders its network-error state because
  `api.bargainhuntrs.com` was unreachable from this machine during capture
  (30s+ timeouts through api-guard → tunnel → oracle) — recapture the feed,
  deal detail, and signed-in watchlist on a real device when the API is up.
