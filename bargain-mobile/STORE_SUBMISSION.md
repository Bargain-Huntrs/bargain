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

## Play record status — LIVE on Google Play (verified 2026-12-31)
- **Console app ID:** `4974945556249240068` (dev account `PrimeTransit` /
  `8349879999610974643`)
- **Public listing:** https://play.google.com/store/apps/details?id=com.bargainhuntrs.mobile
  (200, title "BargainHuntrs - Apps on Google Play", icon + 6 screenshots live)
- **Releases:** vc1 (1.0.0) `completed` on **production (100% rollout since
  Nov 17, 2026)**, internal, and alpha. Live bundle sha256
  `2ca84f7d…` is the same artifact as `dist/bargain.aab`.
- **Declarations:** all 11 actioned Nov 13, 2026 — data safety, target
  audience, IARC content ratings, ads, ad-ID, privacy policy, sign-in
  details, financial features, health, government, app-level trader
  status + ToS. Public data-safety card shows "No data shared" /
  "Data is encrypted".
- **SA access:** `eas-play-submit@prime-transit.iam.gserviceaccount.com`
  has full permissions (granted 2026-12-24; the earlier "no record" 404s
  were per-app permission invisibility, not absence — same as ClipStakes).
- **Outstanding:** dashboard notice "Declare your trader status by
  February 1, 2027" — trader status is already actioned; this is a
  forward re-attestation deadline, not a current task. Next upload MUST
  bump `versionCode`/`version` in `app.json` first (still 1/1.0.0).

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

## Console-side checklist — ALL DONE (actioned Nov 13, 2026)
- [x] App record created — `BargainHuntrs`, App, Free, en-US
- [x] AAB uploaded + releases on internal/alpha/production (vc1 live 100%)
- [x] Content rating questionnaire (IARC)
- [x] Data safety — declared + live on the public listing card
- [x] Target audience declaration
- [x] Sign-in details / app access declaration
- [x] Store listing — title/desc/icon/feature graphic/6 phone screenshots
      (all live; verified via both REST `edits` reads and the public page)
- [x] Privacy policy URL — https://bargainhuntrs.com/privacy (live, 200)
- [x] Account-deletion link — https://bargainhuntrs.com/delete-account
      (live, 200; in-app delete also shipped `c413dd1`)
- [ ] 2027-02-01 — trader-status re-attestation deadline (dashboard notice)

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
