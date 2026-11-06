import type { Metadata } from "next";

// Dropship pools board — the page redirects anonymous visitors to /login, so
// it has no public content to index. Kept noindex; title helps browser UX.
export const metadata: Metadata = {
  title: "Dropship Pools — Group-Buy Inventory Deals",
  description:
    "Pool buying power with other hunters to meet supplier MOQs at group-negotiated rates — commit units, capture on fill.",
  robots: { index: false, follow: false },
};

export default function DropshipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
