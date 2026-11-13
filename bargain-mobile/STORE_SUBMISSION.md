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
Signed release AAB recipe (used for `dist/bargain.aab`, vc1):
```bash
cd bargain-mobile
pnpm expo prebuild -p android            # regenerates gitignored android/
node scripts/android-release-signing.mjs # wires signingConfigs.release → credentials/android/keystore.properties
cd android && GRADLE_USER_HOME=/Volumes/Os_Sites/tools/gradle ./gradlew bundleRelease
cp app/build/outputs/bundle/release/app-release.aab ../dist/bargain.aab
```
Upload key: `credentials/android/bargain-release.jks` (alias `bargain-upload`,
gitignored; passwords in `credentials/android/keystore.properties`, mode 600).
**Backup:** full keystore + passwords + fingerprint live in `~/.devin-vault`
entry `bargain-android-upload-key` — restore from there if the local
`credentials/` dir is wiped.
Cert SHA-256: `16:6C:5A:76:11:36:C8:09:12:EB:1C:12:C3:36:B7:05:83:41:C6:A2:2E:C5:FE:52:7A:60:E3:36:06:47:53:D9`
First Play upload registers this as the upload key; Play App Signing holds the
app-signing key. Do NOT regenerate the JKS after first upload (a new key would
need a Play Console upload-key reset).

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
