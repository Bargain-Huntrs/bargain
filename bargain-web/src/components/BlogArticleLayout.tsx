import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export interface BlogArticleConfig {
  title: string;
  description: string;
  publishedTime: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string[];
  jsonLd?: object;
  relatedArticles?: { href: string; title: string }[];
}

export default function BlogArticleLayout({
  config,
  children,
}: {
  config: BlogArticleConfig;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      {config.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(config.jsonLd) }}
        />
      )}

      <Header />

      <main className="flex-1">
        <article className="px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              &larr; Back to blog
            </Link>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50 leading-tight">
              {config.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span>By {config.author || "BargainHuntrs Team"}</span>
              <span>&middot;</span>
              <time dateTime={config.publishedTime}>
                {new Date(config.publishedTime).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>

            <div className="mt-8 max-w-none space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-50 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-50 [&_a]:text-emerald-600 dark:[&_a]:text-emerald-400 [&_a]:font-medium [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-50 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-400 [&_blockquote]:pl-4 [&_blockquote]:italic">
              {children}
            </div>

            {/* CTA */}
            <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Start finding deals today
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Get instant alerts when prices drop. Join BargainHuntrs for free.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
                >
                  Get started free
                </Link>
                <Link
                  href="/deals"
                  className="rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  Browse All Deals
                </Link>
              </div>
            </div>

            {/* Related articles */}
            {config.relatedArticles && config.relatedArticles.length > 0 && (
              <div className="mt-12">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                  Related articles
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {config.relatedArticles.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {a.title}
                      </p>
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        Read more &rarr;
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
