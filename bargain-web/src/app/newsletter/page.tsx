import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Newsletter Preferences – BargainHuntrs",
  description: "Manage your BargainHuntrs deal-digest subscription — subscribe or unsubscribe.",
  robots: { index: false },
};

export default function NewsletterPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <section className="px-6 py-24">
          <div className="mx-auto max-w-lg text-center">
            <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-6">
              Newsletter
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Deal digest preferences
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Manage your BargainHuntrs newsletter subscription below.
            </p>
            <div className="mt-10">
              <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
                <UnsubscribeClient />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
