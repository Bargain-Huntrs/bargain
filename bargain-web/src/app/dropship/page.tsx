"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  getDropshipPools,
  getDropshipCurated,
  getDropshipProducts,
  getDropshipNiches,
  getMyDropshipCommits,
  commitToDropshipPool,
  toggleDropshipWatch,
  saveDropshipProduct,
  unsaveDropshipProduct,
  getDropshipChannels,
  voteDropshipChannel,
  type DropshipPool,
  type DropshipProduct,
  type DropshipNiche,
  type DropshipChannel,
} from "@/lib/api";

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${n.toFixed(2)}`;

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closing…";
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function PoolCard({
  pool,
  paid,
  onCommit,
  committing,
}: {
  pool: DropshipPool;
  paid: boolean;
  onCommit: (pool: DropshipPool, units: number) => void;
  committing: boolean;
}) {
  const [units, setUnits] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const p = pool.product;
  const open = pool.status === "open";
  const committed = !!pool.my_commit;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
            {p?.title || "Pool"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {p?.supplier} ·{" "}
            {pool.origin === "china"
              ? `China → ${pool.freight_mode === "air" ? "air freight" : "ocean"}`
              : `ships from ${p?.warehouse_state || "US"}`}
            {" · "}≤{pool.delivery_days_max}d · {pool.channel === "amazon_fba" ? "your FBA" : pool.channel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            pool.status === "open"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : pool.status === "filled"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {pool.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {pool.units_committed} / {pool.moq_units} units
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {open ? timeLeft(pool.closes_at) : pool.status === "filled" ? "pool filled" : "expired"}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, pool.fill_pct)}%` }}
          />
        </div>
      </div>

      {/* Deal sheet numbers */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/60">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Your cost</p>
          <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-50">{money(pool.unit_cost)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/60">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Target sell</p>
          <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-50">
            {pool.min_price ? `${money(pool.min_price)}–${money(pool.target_price)}` : money(pool.target_price)}
          </p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-2 py-2 dark:bg-emerald-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Est. margin</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {pool.est_margin_pct !== null ? `${pool.est_margin_pct}%` : "—"}
          </p>
        </div>
      </div>

      {/* Commit controls */}
      {committed ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
          You&apos;re in — {pool.my_commit!.units} unit{pool.my_commit!.units === 1 ? "" : "s"} at{" "}
          {money(pool.my_commit!.unit_price)} ({pool.my_commit!.status})
        </div>
      ) : open ? (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700">
            <button
              className="px-2.5 py-1.5 text-sm text-zinc-600 disabled:opacity-40 dark:text-zinc-400"
              disabled={units <= 1}
              onClick={() => setUnits((u) => Math.max(1, u - 1))}
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold text-zinc-900 dark:text-zinc-50">{units}</span>
            <button
              className="px-2.5 py-1.5 text-sm text-zinc-600 disabled:opacity-40 dark:text-zinc-400"
              disabled={units >= Math.min(pool.max_units_per_hunter, pool.units_remaining)}
              onClick={() => setUnits((u) => Math.min(pool.max_units_per_hunter, pool.units_remaining, u + 1))}
            >
              +
            </button>
          </div>
          {paid && !confirming ? (
            <button
              disabled={committing || pool.units_remaining === 0}
              onClick={() => setConfirming(true)}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pool.units_remaining === 0
                ? "Pool full"
                : `Commit ${units} unit${units === 1 ? "" : "s"} — ${money(units * pool.unit_cost)}`}
            </button>
          ) : paid && confirming ? (
            <div className="flex-1 space-y-1.5">
              <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                You&apos;re buying {units} unit{units === 1 ? "" : "s"} of inventory at the group rate — resale
                isn&apos;t guaranteed and you sell them yourself. Charged only if the pool fills.
              </p>
              <div className="flex gap-1.5">
                <button
                  disabled={committing}
                  onClick={() => onCommit(pool, units)}
                  className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Lock it in
                </button>
                <button
                  disabled={committing}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/pricing"
              className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Upgrade to join pools
            </Link>
          )}
        </div>
      ) : null}
      <p className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
        {open
          ? "Reserved now — charged only if the pool fills. Cancels free if it doesn't."
          : ""}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  paid,
  onWatch,
  onSave,
}: {
  product: DropshipProduct;
  paid: boolean;
  onWatch: (p: DropshipProduct) => void;
  onSave: (p: DropshipProduct) => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {product.title}
        </p>
        {product.est_margin_pct !== null && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {product.est_margin_pct}%
          </span>
        )}
      </div>
      {product.why && (
        <p className="mt-1.5 text-xs italic text-emerald-700 dark:text-emerald-400">✦ {product.why}</p>
      )}
      {product.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {product.description}
        </p>
      )}
      <div className="mt-3 flex items-baseline gap-2 text-xs">
        <span className="font-bold text-zinc-900 dark:text-zinc-50">{money(product.cost)}</span>
        <span className="text-zinc-400">→</span>
        <span className="font-semibold text-zinc-600 dark:text-zinc-300">{money(product.suggested_price)}</span>
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
          {product.shipping_days_min}–{product.shipping_days_max}d · {product.warehouse_state || "US"}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onWatch(product)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
            product.watching
              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
          title="Watch to vote it toward a pool"
        >
          {product.watching ? "★ Watching" : "☆ Watch"}
        </button>
        {paid ? (
          <button
            onClick={() => onSave(product)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
              product.saved
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {product.saved ? "✓ Saved" : "Save"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function DropshipPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();
  const [tier, setTier] = useState("free");
  const [pools, setPools] = useState<DropshipPool[]>([]);
  const [myCommits, setMyCommits] = useState<DropshipPool[]>([]);
  const [curated, setCurated] = useState<{ ai: boolean; niches: string[] | null; items: DropshipProduct[] } | null>(null);
  const [products, setProducts] = useState<DropshipProduct[]>([]);
  const [niches, setNiches] = useState<DropshipNiche[]>([]);
  const [channels, setChannels] = useState<DropshipChannel[]>([]);
  const [niche, setNiche] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [committing, setCommitting] = useState(false);
  const [busy, setBusy] = useState(true);

  const paid = tier !== "free";

  const load = useCallback(async () => {
    if (!idToken) return;
    setBusy(true);
    try {
      const [poolRows, curatedRes, productRows, nicheRows, myRows, channelRows] = await Promise.all([
        getDropshipPools(idToken, "all").catch(() => []),
        getDropshipCurated(idToken).catch(() => null),
        getDropshipProducts(idToken, niche ? { niche } : {}).catch(() => []),
        getDropshipNiches(idToken).catch(() => []),
        getMyDropshipCommits(idToken).catch(() => []),
        getDropshipChannels(idToken).catch(() => []),
      ]);
      setPools(poolRows);
      if (curatedRes) setCurated({ ai: curatedRes.ai, niches: curatedRes.niches, items: curatedRes.items });
      setProducts(productRows);
      setNiches(nicheRows);
      setMyCommits(myRows.filter((p) => p.my_commit));
      setChannels(channelRows);
    } finally {
      setBusy(false);
    }
  }, [idToken, niche]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!idToken) return;
    // Resolve tier from /auth/me via the same call pattern used elsewhere.
    import("@/lib/api").then(({ getCurrentUser }) =>
      getCurrentUser(idToken)
        .then((u) => setTier((u.subscription_tier || u.subscriptionTier || "free").toLowerCase()))
        .catch(() => {})
    );
    void load();
  }, [user, loading, idToken, router, load]);

  async function handleCommit(pool: DropshipPool, units: number) {
    if (!idToken) return;
    setCommitting(true);
    setError("");
    setNotice("");
    try {
      const res = await commitToDropshipPool(idToken, pool.id, units);
      setNotice(
        res.pool_status === "filled"
          ? "Pool filled — your units are locked in at the group rate."
          : `Committed ${units} unit${units === 1 ? "" : "s"} — you're charged only if the pool fills.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  async function handleChannelVote(key: string) {
    if (!idToken) return;
    try {
      const res = await voteDropshipChannel(idToken, key);
      setChannels((prev) =>
        prev.map((c) => (c.key === key ? { ...c, voted: res.voted, votes: res.votes } : c))
      );
    } catch {
      // non-fatal
    }
  }

  async function handleWatch(product: DropshipProduct) {
    if (!idToken) return;
    try {
      const res = await toggleDropshipWatch(idToken, product.id);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, watching: res.watching } : p))
      );
      setCurated((prev) =>
        prev
          ? { ...prev, items: prev.items.map((p) => (p.id === product.id ? { ...p, watching: res.watching } : p)) }
          : prev
      );
    } catch {
      // non-fatal
    }
  }

  async function handleSave(product: DropshipProduct) {
    if (!idToken) return;
    try {
      if (product.saved) {
        await unsaveDropshipProduct(idToken, product.id);
      } else {
        await saveDropshipProduct(idToken, product.id);
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, saved: !product.saved } : p))
      );
      setCurated((prev) =>
        prev
          ? { ...prev, items: prev.items.map((p) => (p.id === product.id ? { ...p, saved: !product.saved } : p)) }
          : prev
      );
    } catch {
      // non-fatal
    }
  }

  const openPools = useMemo(() => pools.filter((p) => p.status === "open"), [pools]);
  const recentPools = useMemo(() => pools.filter((p) => p.status !== "open").slice(0, 4), [pools]);

  return (
    <div className="flex min-h-full flex-col bg-white dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Hero */}
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 dark:border-zinc-800 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-950">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Dropship Pools
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Group buying power, solo dropship economics.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            AI curates US-warehouse products and posts a deal sheet — bulk cost, target sell price,
            estimated margin. Commit units with other hunters to hit the wholesale rate; your units
            are yours, you resell them on your own store.
          </p>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
            {[
              ["① Commit units", "Reserve your share of the bulk order — capped per hunter, locked once committed."],
              ["② Pool fills", "All-or-nothing: the group rate locks when the MOQ is hit. Expired pools cost nothing."],
              ["③ You resell", "Units are yours — flip them on your own store or marketplace at the target price."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl bg-white/70 p-3 dark:bg-zinc-900/70">
                <p className="font-bold text-zinc-900 dark:text-zinc-50">{title}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Channel votes — which retailer integration ships next */}
        {channels.length > 0 && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Where should your units sell next?
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {channels.map((c) => (
                <button
                  key={c.key}
                  onClick={() => handleChannelVote(c.key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    c.voted
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {c.label}
                      {c.live && (
                        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          live
                        </span>
                      )}
                    </p>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {c.votes} {c.voted ? "★" : "☆"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            {notice}
          </div>
        )}

        {/* My units */}
        {myCommits.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              My pool units
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {myCommits.map((p) => (
                <span
                  key={p.commit_id || p.id}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  {p.my_commit!.units}× {p.product?.title?.slice(0, 40)} — {p.my_commit!.status}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Open pools */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Open pools</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {openPools.length} live · charged only on fill · resale not guaranteed
            </p>
          </div>
          {openPools.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {busy ? "Loading pools…" : "No open pools right now — watch products below to vote the next one in."}
            </div>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openPools.map((p) => (
                <PoolCard key={p.id} pool={p} paid={paid} onCommit={handleCommit} committing={committing} />
              ))}
            </div>
          )}
          {recentPools.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              Recent:{" "}
              {recentPools.map((p) => (
                <span key={p.id} className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                  {p.product?.title?.slice(0, 32)} — {p.status}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* AI curated */}
        {curated && curated.items.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                Picked for your niche{curated.niches ? "s" : ""}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {curated.ai ? "✦ AI-curated" : "ranked by margin + trend"}
              </p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {curated.items.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} paid={paid} onWatch={handleWatch} onSave={handleSave} />
              ))}
            </div>
          </section>
        )}

        {/* Full catalog */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
              US-warehouse catalog
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ★ Watch a product to vote it toward the next pool
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setNiche(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                niche === null
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              All
            </button>
            {niches.map((n) => (
              <button
                key={n.key}
                onClick={() => setNiche(n.key === niche ? null : n.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  niche === n.key
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {n.emoji} {n.display_name} ({n.count})
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} paid={paid} onWatch={handleWatch} onSave={handleSave} />
            ))}
          </div>
          {!busy && products.length === 0 && (
            <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No products in this niche yet.
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
