# Google Play — reviewer credentials & app-access declaration

# 2026-12-19 · droid-store-prep

`com.bargainhuntrs.mobile` — **no Play record yet** (app creation is
console-only). Submit recipe: `bargain-mobile/STORE_SUBMISSION.md` +
`bargain-mobile/scripts/play-submit.mjs`.

## Verified reviewer account (login verified live → JWT, 2026-12-19)

| Account | Password | Notes |
|---|---|---|
| play.review.bargain@bargainhuntrs.com | PlayReview!2026 | created via `POST /api/v1/auth/register` on api.bargainhuntrs.com |

## Reviewer path

- The deals feed is PUBLIC — the app offers guest browse on the login
  screen; a reviewer can see deals without an account.
- Sign in with the demo account → watchlist, alerts, profile, referrals.
- Gates: **none on login** — `email_verified=false` does not block sign-in
  (the flag is returned, not enforced). Register asks for name + phone
  (E.164) + strong password but a reviewer never needs to self-register.
- No invite code, no device approval, no geo-gate, no paywall, no IAP.

## Suggested Play declaration text

> Sign in with Email + Password: play.review.bargain@bargainhuntrs.com /
> PlayReview!2026. The deals feed is also browsable without an account via
> guest mode on the sign-in screen. No OTP or invite code required.
