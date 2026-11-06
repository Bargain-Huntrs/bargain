import type { Metadata } from "next";

// Auth utility page — keep out of the index.
export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your BargainHuntrs account email address.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
