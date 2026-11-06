import type { Metadata } from "next";

// Auth utility page — keep out of the index.
export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your BargainHuntrs account password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
