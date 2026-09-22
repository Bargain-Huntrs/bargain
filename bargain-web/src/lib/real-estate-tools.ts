// Real estate investor tools — outbound resource links.
// Swap each `href` for the affiliate tracking URL once the partner accounts
// are approved (PropStream, DealMachine, and BatchLeads all run referral
// programs through their own portals / Impact / PartnerStack).

export interface RealEstateTool {
  name: string;
  href: string;
  blurb: string;
  badge?: string;
}

export const REAL_ESTATE_TOOLS: RealEstateTool[] = [
  {
    name: "PropStream",
    href: "https://www.propstream.com/",
    blurb:
      "Pull comps, foreclosure data, and owner info to estimate ARV before you make an offer.",
    badge: "Comps & data",
  },
  {
    name: "DealMachine",
    href: "https://www.dealmachine.com/",
    blurb:
      "Driving-for-dollars app — spot distressed properties and mail the owner from the curb.",
    badge: "Off-market",
  },
  {
    name: "BatchLeads",
    href: "https://batchleads.com/",
    blurb:
      "Build motivated-seller lists and reach owners directly — skip tracing included.",
    badge: "Seller lists",
  },
];
