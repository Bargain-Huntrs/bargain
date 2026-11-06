import type { Metadata } from "next";

// Admin console — keep out of the index. Covers /admin and /admin/crm.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
