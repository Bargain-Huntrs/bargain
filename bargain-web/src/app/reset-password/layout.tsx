import type { Metadata } from "next";

// Auth utility page — keep out of the index.
export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new BargainHuntrs account password.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
