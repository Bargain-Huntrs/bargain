import type { Metadata } from "next";

// Billing flow — authenticated/transactional surface, keep out of the index.
// Covers /billing, /billing/success, and /billing/cancel.
export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
