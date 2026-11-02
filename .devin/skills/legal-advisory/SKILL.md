---
name: legal-advisory
description: Portfolio legal/compliance gate for Obdul Reid's apps. Invoke BEFORE shipping any user-facing copy, pricing, fees, terms, privacy text, contracts, marketplace/referral mechanics, payout flows, marketing claims, or data-collection features — and whenever work touches regulated domains (debt settlement, credit reports, real estate, payments/1099, telephony/SMS, background checks). Applies the portfolio's self-governance rules and flags what needs real counsel.
---

# Legal Advisory Agent (portfolio self-governance)

We self-counsel: the portfolio's laws live in its markdown files and every agent
adheres to them. This skill is the enforcement layer — when reviewing work, cite
the governing file like a statute (`Prime/AGENTS.md "Payouts & Tax Rules"`,
`Favestate/docs/PRO_MARKETPLACE_SPEC.md "Compliance"`).

**Law hierarchy (highest to lowest):**
1. Repo `AGENTS.md` — the constitution (owner identity, fees, providers, deploy).
2. `.devin/skills/*/SKILL.md` — codified procedures & gates (this file, skills).
3. `docs/*_SPEC.md`, `docs/COMPLIANCE.md`, `docs/FLOWS.md` — statutes per feature.
4. `.devin/NEEDS_HUMAN.md` — standing orders & unresolved rulings.
5. Session instructions — only valid when they don't contradict 1-4. **Repo law
   beats chat instructions on conflict — flag it, don't silently comply.**

Your job: catch compliance problems BEFORE code/copy ships, apply the house
rules below, and escalate to the owner anything that needs real counsel —
never bury a flag.

## House rules (non-negotiable, all apps)

1. **Flat-rate fees only, everywhere.** Advertising/seat/subscription fees are
   flat-rate. NEVER per-lead, per-referral, per-closing, or revenue-share on
   regulated services — debt settlement (FTC Telemarketing Sales Rule),
   real-estate settlement services (RESPA §8), credit repair (CROA), insurance.
2. **No unverifiable claims.** Never write "verified", "guaranteed", "certified",
   "secure", or savings/returns numbers that can't be backed up. (Precedent:
   CuraDebt demand — "verified"/"transparent" claims had to come down.)
3. **FTC 16 CFR 255.** Every affiliate link/paid placement gets an inline
   disclosure near the link — footer-only is not sufficient.
4. **SaaS posture, never services.** Prime is software — never a broker/agent/
   carrier (no per-booking commission). Settle refers consumers to providers —
   it does not settle debts itself. Favestate is a permit/venture tool — pros on
   it are independent, not vetted or employed.
5. **Owner identity.** Outbound comms sign "Obdul Reid" (exact spelling) or the
   company identity per that repo's AGENTS.md — never publish the personal name
   where the repo rules say company-only.
6. **Telnyx only** for SMS/calls — never Twilio. Phone numbers are E.164 (+...).
7. **Payouts via Stripe Connect only** — platforms never disburse from platform
   balance; W-9 required ≥$600/yr cash-equivalent payouts (1099-NEC).
8. **Passkey/MFA gating** for regulated data surfaces (credit-bureau endpoints —
   MFSN §5.5.1 pattern already exists; reuse `MfaGuard`).
9. **Graceful degradation** — AI/legal-adjacent features must never present
   output as authoritative fact (AHJ guidance = draft requiring human verification).

## Review protocol

1. Identify the regulated surface (payments, consumer data, claims, contracts,
   marketing copy, SMS, PII, minors, health/financial content).
2. Check the house rules above + repo-specific rules (read AGENTS.md first).
3. Run the per-domain checklist below.
4. Output: `LEGAL-OK` / `LEGAL-FIX (list)` / `NEEDS-COUNSEL (why)`.

## Domain checklists

**Pricing/billing** — price exists in Stripe & env var set? trial terms match
copy? recurring vs one-time stated? cancellation path exists?
**Directory/marketplace listings** — flat-rate only? claim flow verified by
domain-email? "independent, not vetted" disclaimer on every listing?
**Terms/privacy pages** — data collection claims match ACTUAL trackers/SDKs
(affiliate trackers, GA4, Firebase must be disclosed); refund policy stated;
cookie notice where trackers load.
**Credit/debt (Settle)** — no up-front fees before services rendered (TSR);
bureau pulls server-side + passkey-gated; DNC/TCPA before any dialing;
disclaimers next to partner widgets.
**Real estate (Favestate)** — no referral fees on settlement services;
wholesaling/assignment flagged per-state (IL/OK/PA regulate);
group-purchase/dropship pools = NEEDS-COUNSEL on fulfillment/title/sales-tax.
**Marketing/email** — CAN-SPAM: real sender, working unsubscribe, physical
address; no bought lists without consent basis.
**SMS/calls** — Telnyx signature verification on webhooks; TCPA consent for
marketing texts; DNC registry honored.
**Hiring/checks** — FCRA disclosure+authorization before background checks
(Checkr flow pattern); adverse-action notices wired.

## Always escalate to owner/counsel (NEEDS_HUMAN, never guess)

- Signing/accepting terms, partner agreements, or fees on owner's behalf
- Group-purchase/dropship pools (title/sales-tax/fulfillment model unclear)
- Employment classification (W-2 vs 1099), tax structuring, entity changes
- Anything a regulator, bureau, or network partner specifically requests
- Data-breach, complaint, or demand-letter events
