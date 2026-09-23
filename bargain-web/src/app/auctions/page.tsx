"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getListings,
  getListingCategories,
  getListingStates,
  type AuctionListing,
} from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  gsa_auctions: "GSA Auctions",
  govdeals: "GovDeals",
};

const CATEGORY_LABELS: Record<string, string> = {
  surplus: "Gov Surplus",
  vehicle: "Vehicles",
  bullion: "Bullion",
};

const PER_PAGE = 24;

function fmtBid(value: string | null): string {
  if (!value) return "No bids yet";
  const n = parseFloat(value);
  return Number.isFinite(n)
    ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "—";
}

function fmtCountdown(end: string | null): string | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

export default function AuctionsPage() {
  const [items, setItems] = useState<AuctionListing[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [states, setStates] = useState<{ state: string; count: number }[]>([]);
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState("ending_soon");
  const [maxBid, setMaxBid] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getListingCategories()
      .then((d) => setCategories(d.categories))
      .catch(() => {});
    getListingStates()
      .then((d) => setStates(d.states))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getListings({
        category: category || undefined,
        state: state || undefined,
        sort: sort as any,
        max_bid: maxBid ? parseFloat(maxBid) : undefined,
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
  }, [category, state, sort, maxBid, query, page]);

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
            Live government surplus
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Government Auctions &amp; Surplus
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Federal surplus lots aggregated from public government auction
            feeds — vehicles, equipment, aircraft, and more. Bid directly on
            the source site.
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
              placeholder="Search lots…"
              className={`${inputCls} w-64`}
            />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {CATEGORY_LABELS[c.category] ?? c.category} ({c.count})
                </option>
              ))}
            </select>
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
              value={maxBid}
              onChange={(e) => {
                setMaxBid(e.target.value.replace(/\D/g, ""));
                setPage(1);
              }}
              placeholder="Max bid $"
              inputMode="numeric"
              className={`${inputCls} w-28`}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls}>
              <option value="ending_soon">Ending soon</option>
              <option value="newest">Newest</option>
              <option value="bid_asc">Bid: low → high</option>
              <option value="bid_desc">Bid: high → low</option>
            </select>
            <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-500">
              {loading ? "Loading…" : `${total.toLocaleString()} lots`}
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
                  No lots match these filters yet — inventory refreshes as new
                  government auctions are published.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l) => {
                const countdown = fmtCountdown(l.end_date);
                return (
                  <article
                    key={l.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.image_url}
                          alt={l.title}
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
                          {SOURCE_LABELS[l.source] ?? l.source}
                        </span>
                        {l.status && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold text-white ${
                              l.status.toLowerCase() === "active"
                                ? "bg-emerald-600/90"
                                : "bg-amber-600/90"
                            }`}
                          >
                            {l.status}
                          </span>
                        )}
                      </div>
                      {countdown && (
                        <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
                          {countdown}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-snug line-clamp-2">
                            {l.title}
                          </h2>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {[l.city, l.state].filter(Boolean).join(", ")}
                            {l.source_category ? ` · ${l.source_category}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-baseline gap-2">
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          {fmtBid(l.current_bid)}
                        </p>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          current bid
                          {l.num_bids ? ` · ${l.num_bids} bid${l.num_bids === 1 ? "" : "s"}` : ""}
                        </span>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-4">
                        <a
                          href={l.detail_url}
                          target="_blank"
                          rel="sponsored noopener noreferrer"
                          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
                        >
                          Bid on {SOURCE_LABELS[l.source] ?? "source"} →
                        </a>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {l.sale_method ?? "auction"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
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
              Lots are aggregated from public government auction feeds and
              link out to the source site. BargainHuntrs is not an auctioneer
              and is not a party to any sale — verify all details, condition,
              and bidding rules with the selling agency before bidding.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
