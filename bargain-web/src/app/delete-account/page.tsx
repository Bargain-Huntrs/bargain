import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
  title: "Delete Your Account – BargainHuntrs",
  description:
    "Delete your BargainHuntrs account and personal data — self-service for signed-in users, or email privacy@bargainhuntrs.com to request deletion.",
  alternates: { canonical: "/delete-account" },
};

export default function DeleteAccountPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Delete your account
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Permanently remove your BargainHuntrs account and personal data.
          </p>

          <div className="mt-8">
            <DeleteAccountClient />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
