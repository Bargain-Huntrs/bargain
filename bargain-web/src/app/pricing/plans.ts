// Shared pricing plan data used by both the server-rendered pricing page
// (comparison table / FAQ) and the client-side plan cards (Stripe checkout).
//
// `planId` maps each frontend plan to a backend subscription plan id
// ("free" | "hunter") used by the /subscriptions/create-checkout-session
// endpoint. The actual Stripe price is configured via env vars on the backend.

export interface PlanFeature {
  label: string;
  value: string;
}

export interface Plan {
  name: string;
  planId: "free" | "hunter" | "pro" | "agency";
  price: string;
  period: string;
  tagline: string;
  description: string;
  cta: string;
  href: string;
  highlight: boolean;
  badge: string | null;
  features: PlanFeature[];
}

export const plans: Plan[] = [
  {
    name: "Free",
    planId: "free",
    price: "$0",
    period: "forever",
    tagline: "Start finding deals today.",
    description:
      "No credit card. Browse every deal we find, get daily alerts, and save money from day one.",
    cta: "Start free",
    href: "/signup",
    highlight: false,
    badge: null,
    features: [
      { label: "Browse all deals", value: "✓" },
      { label: "Coupon codes", value: "✓" },
      { label: "Daily email alerts", value: "✓" },
      { label: "Watchlist items", value: "10" },
      { label: "Price history", value: "30 days" },
      { label: "SMS alerts", value: "—" },
      { label: "Instant alerts", value: "—" },
      { label: "Priority deals", value: "—" },
      { label: "Support", value: "Community" },
    ],
  },
  {
    name: "Hunter",
    planId: "hunter",
    price: "$9.99",
    period: "/ month",
    tagline: "Never miss a deal.",
    description:
      "Instant alerts, unlimited watchlist, SMS notifications, and priority access to the best deals before anyone else.",
    cta: "Go Hunter",
    href: "/signup",
    highlight: true,
    badge: "Best value",
    features: [
      { label: "Browse all deals", value: "✓" },
      { label: "Coupon codes", value: "✓" },
      { label: "Instant email alerts", value: "✓" },
      { label: "SMS alerts", value: "✓" },
      { label: "Watchlist items", value: "Unlimited" },
      { label: "Price history", value: "Full" },
      { label: "Priority deals", value: "✓" },
      { label: "Early access to glitches", value: "✓" },
      { label: "Support", value: "Email" },
    ],
  },
  {
    name: "Pro",
    planId: "pro",
    price: "$19",
    period: "/ month",
    tagline: "For serious resellers.",
    description:
      "Everything in Hunter plus API access, bulk deal export, and margin analytics for sourcing at volume.",
    cta: "Go Pro",
    href: "/signup",
    highlight: false,
    badge: null,
    features: [
      { label: "Everything in Hunter", value: "✓" },
      { label: "Deal API access", value: "✓" },
      { label: "Bulk export (CSV)", value: "✓" },
      { label: "Margin analytics", value: "✓" },
      { label: "Multi-channel alerts", value: "✓" },
      { label: "Support", value: "Priority" },
    ],
  },
  {
    name: "Agency",
    planId: "agency",
    price: "$49",
    period: "/ month",
    tagline: "Deal sourcing for teams.",
    description:
      "Multi-seat access, white-label alerts, and pooled deal flow for reselling teams and agencies.",
    cta: "Go Agency",
    href: "/signup",
    highlight: false,
    badge: null,
    features: [
      { label: "Everything in Pro", value: "✓" },
      { label: "Team seats", value: "5" },
      { label: "White-label alerts", value: "✓" },
      { label: "Pooled deal flow", value: "✓" },
      { label: "Support", value: "Dedicated" },
    ],
  },
];
