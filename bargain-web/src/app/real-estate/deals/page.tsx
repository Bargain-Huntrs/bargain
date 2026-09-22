"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getProperties,
  getPropertyStates,
  type Property,
} from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  hud_homestore: "HUD Home Store",
};

const PER_PAGE = 24;

function fmtPrice(value: string | null): string {
  if (!value) return "—";
  const n = parseFloat(value);
  return Number.isFinite(n) ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";
}

function fmtNum(value: string | number | null, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `${n % 1 === 0 ? n : n.toFixed(1)}${suffix}`;
}

export default function RealEstateDealsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [states, setStates] = useState<{ state: string; count: number }[]>([]);
  const [state, setState] = useState("");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getPropertyStates()
      .then((d) => setStates(d.states))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getProperties({
        state: state || undefined,
        sort: sort as any,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        min_beds: minBeds ? parseFloat(minBeds) : undefined,
        q: query || undefined,
        page,
        per_page: PER_PAGE,
      });
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [state, sort, minPrice, maxPrice, minBeds, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const inputCls =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1">
        {/* Header band */}
        <section className="px-6 py-10 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-4">
            Live public inventory
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Distressed Property Deals
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Bank-owned and government REO listings aggregated from public
            sources. Run any deal through the{" "}
            <Link href="/tools/real-estate-calculator" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              free bargain calculator
            </Link>{" "}
            before you offer.
          </p>
        </section>

        {/* Filters */}
        <section className="px-6 pt-8">
          <div className="mx-auto max-w-6xl flex flex-wrap items-end gap-3">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search address, city, county…"
              className={`${inputCls} w-64`}
            />
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({s.count})
                </option>
              ))}
            </select>
            <input
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value.replace(/\D/g, ""));
                setPage(1);
              }}
              placeholder="Min $"
              inputMode="numeric"
              className={`${inputCls} w-28`}
            />
            <input
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value.replace(/\D/g, ""));
                setPage(1);
              }}
              placeholder="Max $"
              inputMode="numeric"
              className={`${inputCls} w-28`}
            />
            <select
              value={minBeds}
              onChange={(e) => {
                setMinBeds(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="">Beds</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5+</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="sqft_desc">Largest first</option>
            </select>
            <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-500">
              {loading ? "Loading…" : `${total.toLocaleString()} listings`}
            </span>
          </div>
        </section>

        {/* Grid */}
        <section className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No listings match these filters yet — inventory refreshes
                  daily as new REO properties are published.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={`${p.address}, ${p.city ?? ""} ${p.state ?? ""}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        No photo
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span className="rounded-full bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                        {SOURCE_LABELS[p.source] ?? p.source}
                      </span>
                      {p.status && (
                        <span className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-semibold text-white">
                          {p.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
                          {p.address}
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {[p.city, p.state, p.zip].filter(Boolean).join(", ")}
                          {p.county ? ` · ${p.county} Co.` : ""}
                        </p>
                      </div>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {fmtPrice(p.list_price)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>{fmtNum(p.bedrooms)} bd</span>
                      <span>{fmtNum(p.bathrooms)} ba</span>
                      <span>{p.sqft ? `${p.sqft.toLocaleString()} sqft` : "— sqft"}</span>
                      {p.year_built ? <span>Built {p.year_built}</span> : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <a
                        href={p.detail_url}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
                      >
                        View listing →
                      </a>
                      <Link
                        href="/tools/real-estate-calculator"
                        className="text-xs font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                      >
                        Run the numbers
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                >
                  ← Prev
                </button>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages || loading}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Next →
                </button>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-500 max-w-2xl mx-auto">
              Listings are aggregated from public sources and link out to the
              listing site. BargainHuntrs is not a real estate broker or agent
              and is not a party to any transaction — verify all details,
              condition, and bidding rules with the seller and listing source.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
