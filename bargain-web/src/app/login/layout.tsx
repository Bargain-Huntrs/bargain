import type { Metadata } from "next";

// Auth utility page — keep out of the index.
export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your BargainHuntrs account.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
