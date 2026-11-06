export const metadata = {
  title: "Impact Site Verification",
  description: "Impact site verification page",
  alternates: { canonical: "/impact-verification" },
};

export default function ImpactVerificationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8">
      <pre className="text-base text-zinc-900 font-mono">
        Impact-Site-Verification: c2aacb17-49a0-4116-b515-be1a7e596103
      </pre>
    </div>
  );
}
