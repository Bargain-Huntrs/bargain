"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/lib/authService";
import {
  getCurrentUser,
  getWatchlist,
  addWatchlistItem,
  refreshWatchlistItem,
  deleteWatchlistItem,
  getMyNiches,
  updateMyNiches,
  updateMyPhone,
  getReferralStats,
  getMyDeals,
  getHaul,
  createClaim,
  updateClaim,
  deleteClaim,
  getListItems,
  createListItem,
  deleteListItem,
  getProfitSummary,
  type Niche,
  type MyDeal,
  type DealClaim,
  type UserListItem,
  type ProfitSummary,
} from "@/lib/api";
import ProfitCalculator from "@/components/tools/ProfitCalculator";
import ListingGenerator from "@/components/tools/ListingGenerator";
import RealEstateCalculator from "@/components/tools/RealEstateCalculator";

interface UserData {
  id: string;
  email: string;
  subscription_tier: string;
  phoneNumber?: string | null;
}

interface WatchlistItem {
  id: string;
  item_name: string;
  target_price: number | null;
  current_price: number | null;
  retailers: { url: string; price?: number | null }[];
  created_at: string;
}

type TabKey = "haul" | "shopping" | "wishlist" | "bolo" | "watchlist" | "tools";
type ToolKey = "profit" | "listing" | "realestate";

interface ToolPrefill {
  title?: string;
  buy?: string;
  sell?: string;
  platform?: string;
}

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "haul", label: "My Haul", hint: "Deals you bought — track them to sold" },
  { key: "shopping", label: "Shopping List", hint: "Things you're planning to buy" },
  { key: "wishlist", label: "Wishlist", hint: "Wants you're watching" },
  { key: "bolo", label: "BOLO", hint: "Be on the lookout — we match new deals to these" },
  { key: "watchlist", label: "Watchlist", hint: "Price-tracking alerts" },
  { key: "tools", label: "Tools", hint: "Calculators and generators — no need to leave your HQ" },
];

const TOOLS: { key: ToolKey; label: string; desc: string }[] = [
  { key: "profit", label: "Profit Calculator", desc: "Net profit, ROI & fees before you buy" },
  { key: "listing", label: "Listing Generator", desc: "Optimized title, description & pricing" },
  { key: "realestate", label: "Real Estate Calc", desc: "MAO, flip ROI & rental yield" },
];

const inputCls =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moneyShort(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Cumulative profit chart — realized (solid) + potential (dashed)
function ProfitChart({ series }: { series: ProfitSummary["series"] }) {
  const W = 720;
  const H = 180;
  const PAD = 28;

  const { realizedPath, potentialPath, maxY, days } = useMemo(() => {
    const byDate = new Map<string, { realized: number; potential: number }>();
    for (const p of series) byDate.set(p.date, p);
    const sorted = [...byDate.keys()].sort();
    let cumR = 0;
    let cumP = 0;
    const pts = sorted.map((d) => {
      const v = byDate.get(d)!;
      cumR += v.realized;
      cumP += v.potential;
      return { d, r: cumR, p: cumP };
    });
    const max = Math.max(1, ...pts.map((p) => Math.max(p.r, p.p)));
    const toXY = (i: number, val: number) => {
      const x = PAD + (i / Math.max(1, pts.length - 1)) * (W - PAD * 2);
      const y = H - PAD - (val / max) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    return {
      realizedPath: pts.map((p, i) => toXY(i, p.r)).join(" "),
      potentialPath: pts.map((p, i) => toXY(i, p.p)).join(" "),
      maxY: max,
      days: pts.length,
    };
  }, [series]);

  if (days === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Claim a deal with “I bought this” to start your profit chart.
        </p>
      </div>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - f * (H - PAD * 2)}
            y2={H - PAD - f * (H - PAD * 2)}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeDasharray="2 4"
          />
        ))}
        <text x={4} y={14} className="fill-zinc-400 text-[10px]">
          {moneyShort(maxY)}
        </text>
        <polyline
          points={potentialPath}
          fill="none"
          strokeDasharray="5 4"
          className="stroke-amber-500"
          strokeWidth={2}
        />
        <polyline
          points={realizedPath}
          fill="none"
          className="stroke-emerald-500"
          strokeWidth={2.5}
        />
      </svg>
      <div className="mt-2 flex items-center gap-5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-emerald-500" /> Realized profit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-amber-500" /> Potential profit
        </span>
        <span className="ml-auto">Cumulative, last 90 days</span>
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  onUpdate,
  onDelete,
  onOpenTool,
  busy,
}: {
  claim: DealClaim;
  onUpdate: (id: string, body: Parameters<typeof updateClaim>[2]) => void;
  onDelete: (id: string) => void;
  onOpenTool: (tool: ToolKey, prefill: ToolPrefill) => void;
  busy: boolean;
}) {
  const [soldInput, setSoldInput] = useState("");
  const [listingInput, setListingInput] = useState("");
  const qty = claim.quantity || 1;
  const est = claim.est_net_profit ? parseFloat(claim.est_net_profit) * qty : null;
  const realized =
    claim.status === "sold" && claim.sold_price
      ? (parseFloat(claim.sold_price) - parseFloat(claim.buy_price)) * qty
      : null;

  return (
    <div className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {claim.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={claim.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xl">📦</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {claim.title}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Paid {money(claim.buy_price)} × {qty}
              {claim.buy_platform ? ` · ${claim.buy_platform}` : ""}
              {est !== null && claim.status !== "sold" && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}· est. +{money(est)}
                </span>
              )}
              {realized !== null && (
                <span className={realized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                  {" "}· {realized >= 0 ? "+" : ""}{money(realized)} realized
                </span>
              )}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              claim.status === "sold"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : claim.status === "listed"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {claim.status}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {claim.status === "bought" && (
            <>
              <button
                onClick={() =>
                  onOpenTool("listing", {
                    title: claim.title,
                    buy: claim.buy_price,
                    platform: claim.sell_platform || "ebay",
                  })
                }
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Generate listing
              </button>
              <input
                value={listingInput}
                onChange={(e) => setListingInput(e.target.value)}
                placeholder="Paste listing URL"
                className={`${inputCls} w-40 py-1.5 text-xs`}
              />
              <button
                disabled={busy}
                onClick={() =>
                  onUpdate(claim.id, {
                    status: "listed",
                    ...(listingInput ? { listing_url: listingInput } : {}),
                  })
                }
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Mark listed
              </button>
            </>
          )}
          {claim.status === "listed" && (
            <>
              {claim.listing_url && (
                <a
                  href={claim.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950"
                >
                  View listing ↗
                </a>
              )}
              <input
                value={soldInput}
                onChange={(e) => setSoldInput(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Sold for $"
                inputMode="decimal"
                className={`${inputCls} w-28 py-1.5 text-xs`}
              />
              <button
                disabled={busy || !soldInput}
                onClick={() =>
                  onUpdate(claim.id, { status: "sold", sold_price: parseFloat(soldInput) })
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark sold
              </button>
            </>
          )}
          {claim.status === "sold" && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Sold {money(claim.sold_price)} × {qty}
              {claim.sold_at ? ` · ${new Date(claim.sold_at).toLocaleDateString()}` : ""}
            </span>
          )}
          {claim.status !== "sold" && (
            <button
              onClick={() =>
                onOpenTool("profit", {
                  buy: claim.buy_price,
                  sell: claim.est_sell_price || undefined,
                  platform: claim.sell_platform || "ebay",
                })
              }
              className="text-xs font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
            >
              Analyze →
            </button>
          )}
          <button
            onClick={() => onDelete(claim.id)}
            className="ml-auto text-xs text-zinc-400 hover:text-red-500"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", url: "", target: "" });
  const [adding, setAdding] = useState(false);
  const [availableNiches, setAvailableNiches] = useState<Niche[]>([]);
  const [subscribedNiches, setSubscribedNiches] = useState<string[]>([]);
  const [savingNiches, setSavingNiches] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [referralAura, setReferralAura] = useState<number | null>(null);
  const [myDeals, setMyDeals] = useState<MyDeal[]>([]);

  const [tab, setTab] = useState<TabKey>("haul");
  const [activeTool, setActiveTool] = useState<ToolKey>("profit");
  const [toolPrefill, setToolPrefill] = useState<ToolPrefill>({});
  const [haul, setHaul] = useState<DealClaim[]>([]);
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [listItems, setListItems] = useState<UserListItem[]>([]);
  const [listForm, setListForm] = useState({ title: "", url: "", target: "", notes: "" });
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (idToken) {
      getCurrentUser(idToken).then((data) => {
        setUserData(data);
        setPhoneNumber(data.phoneNumber || "");
      }).catch((err) => setError(err.message));
      loadItems();
      loadNiches();
      loadMyDeals();
      loadHaul();
      loadLists();
      getReferralStats(idToken)
        .then((stats) => {
          setReferralCount(stats.referral_count);
          setReferralAura(stats.total_aura_earned);
        })
        .catch(() => {});
    }
  }, [user, loading, idToken, router]);

  async function loadHaul() {
    if (!idToken) return;
    try {
      const [claims, prof] = await Promise.all([getHaul(idToken), getProfitSummary(idToken)]);
      setHaul(claims);
      setSummary(prof);
    } catch {
      // Non-critical
    }
  }

  async function loadLists() {
    if (!idToken) return;
    try {
      setListItems(await getListItems(idToken));
    } catch {
      // Non-critical
    }
  }

  async function handleUpdateClaim(id: string, body: Parameters<typeof updateClaim>[2]) {
    if (!idToken) return;
    setClaimBusy(true);
    try {
      await updateClaim(idToken, id, body);
      await loadHaul();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setClaimBusy(false);
    }
  }

  async function handleDeleteClaim(id: string) {
    if (!idToken) return;
    try {
      await deleteClaim(idToken, id);
      await loadHaul();
    } catch {
      // Non-critical
    }
  }

  async function handleAddListItem(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || (tab !== "shopping" && tab !== "wishlist" && tab !== "bolo")) return;
    try {
      await createListItem(idToken, {
        list_type: tab,
        title: listForm.title,
        url: listForm.url || undefined,
        target_price: listForm.target ? parseFloat(listForm.target) : undefined,
        notes: listForm.notes || undefined,
      });
      setListForm({ title: "", url: "", target: "", notes: "" });
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function handleDeleteListItem(id: string) {
    if (!idToken) return;
    try {
      await deleteListItem(idToken, id);
      await loadLists();
    } catch {
      // Non-critical
    }
  }

  async function loadMyDeals() {
    if (!idToken) return;
    try {
      const data = await getMyDeals(idToken);
      setMyDeals(data);
    } catch {
      // Non-critical
    }
  }

  async function loadItems() {
    if (!idToken) return;
    try {
      const data = await getWatchlist(idToken);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    }
  }

  async function loadNiches() {
    if (!idToken) return;
    try {
      const data = await getMyNiches(idToken);
      setAvailableNiches(data.available_niches);
      setSubscribedNiches(data.subscribed_niches);
    } catch {
      // Non-critical
    }
  }

  function toggleNiche(key: string) {
    setSubscribedNiches((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function saveNiches() {
    if (!idToken) return;
    setSavingNiches(true);
    try {
      await updateMyNiches(idToken, subscribedNiches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save niche preferences");
    } finally {
      setSavingNiches(false);
    }
  }

  async function savePhone() {
    if (!idToken) return;
    setSavingPhone(true);
    setPhoneSaved(false);
    try {
      await updateMyPhone(idToken, phoneNumber);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save phone number");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setAdding(true);
    try {
      await addWatchlistItem(
        idToken,
        form.name,
        form.url,
        form.target ? parseFloat(form.target) : undefined
      );
      setForm({ name: "", url: "", target: "" });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  }

  async function handleRefresh(itemId: string) {
    if (!idToken) return;
    try {
      await refreshWatchlistItem(idToken, itemId);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  }

  async function handleDelete(itemId: string) {
    if (!idToken) return;
    try {
      await deleteWatchlistItem(idToken, itemId);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleLogout() {
    authService.logout();
    router.push("/");
  }

  const tabListItems = listItems.filter((i) => i.list_type === tab);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Hunter HQ</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {userData?.email || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Profit stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <h2 className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Realized profit</h2>
            <p className="mt-1.5 text-2xl font-bold text-emerald-900 dark:text-emerald-300">
              {moneyShort(summary?.realized_profit ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              {summary?.items_sold ?? 0} sold
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="text-xs font-medium text-amber-700 dark:text-amber-400">Potential profit</h2>
            <p className="mt-1.5 text-2xl font-bold text-amber-900 dark:text-amber-300">
              {moneyShort(summary?.potential_profit ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              {(summary?.items_bought ?? 0) + (summary?.items_listed ?? 0)} unsold
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total spent</h2>
            <p className="mt-1.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {moneyShort(summary?.total_spent ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              across {haul.length} item{haul.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Realized ROI</h2>
            <p className="mt-1.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {summary ? `${(summary.realized_roi * 100).toFixed(0)}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">on sold items</p>
          </div>
          <Link
            href="/referrals"
            className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900/40"
          >
            <h2 className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Referrals</h2>
            <p className="mt-1.5 text-2xl font-bold text-indigo-900 dark:text-indigo-300">
              {referralCount !== null ? referralCount : "—"}
            </p>
            <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-400">
              {referralAura !== null ? `${referralAura} Aura` : "Invite friends →"}
            </p>
          </Link>
        </div>

        {/* Profit chart */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Profit over time</h2>
          <div className="mt-4">
            <ProfitChart series={summary?.series ?? []} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {t.label}
                {t.key === "haul" && haul.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{haul.length}</span>
                )}
                {t.key !== "haul" && t.key !== "watchlist" &&
                  listItems.filter((i) => i.list_type === t.key).length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">
                    {listItems.filter((i) => i.list_type === t.key).length}
                  </span>
                )}
                {t.key === "watchlist" && items.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{items.length}</span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {TABS.find((t) => t.key === tab)?.hint}
          </p>

          <div className="mt-4">
            {/* ── Haul tab ── */}
            {tab === "haul" && (
              <div className="space-y-3">
                {haul.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Nothing in your haul yet. Hit{" "}
                      <span className="font-semibold">📦 I bought this</span> on any deal in the{" "}
                      <Link href="/deals" className="text-emerald-600 hover:underline dark:text-emerald-400">
                        deal feed
                      </Link>{" "}
                      to start tracking.
                    </p>
                  </div>
                ) : (
                  haul.map((c) => (
                    <ClaimCard
                      key={c.id}
                      claim={c}
                      busy={claimBusy}
                      onUpdate={handleUpdateClaim}
                      onDelete={handleDeleteClaim}
                      onOpenTool={(tool, prefill) => {
                        setActiveTool(tool);
                        setToolPrefill(prefill);
                        setTab("tools");
                      }}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Shopping / Wishlist / BOLO tabs ── */}
            {(tab === "shopping" || tab === "wishlist" || tab === "bolo") && (
              <div>
                <form onSubmit={handleAddListItem} className="mb-4 grid gap-2 sm:grid-cols-4">
                  <input
                    required
                    value={listForm.title}
                    onChange={(e) => setListForm({ ...listForm, title: e.target.value })}
                    placeholder={tab === "bolo" ? "Item to hunt (e.g. Dyson V15)" : "Item name"}
                    className={`${inputCls} sm:col-span-2`}
                  />
                  <input
                    value={listForm.target}
                    onChange={(e) => setListForm({ ...listForm, target: e.target.value.replace(/[^\d.]/g, "") })}
                    placeholder="Target $"
                    inputMode="decimal"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Add
                  </button>
                </form>
                {tabListItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {tab === "bolo"
                        ? "Add items you're hunting — we'll flag new deals that match."
                        : "List is empty — add your first item above."}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                    {tabListItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {item.title}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {item.target_price ? `Target: ${money(item.target_price)}` : ""}
                            {item.matched_deal_id && (
                              <Link
                                href={`/deals/${item.matched_deal_id}`}
                                className="ml-2 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                              >
                                ⚡ Deal match found →
                              </Link>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteListItem(item.id)}
                          className="text-xs text-zinc-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Watchlist tab ── */}
            {tab === "watchlist" && (
              <div>
                <form onSubmit={handleAdd} className="mb-4 grid gap-2 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Product name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`${inputCls} sm:col-span-2`}
                  />
                  <input
                    type="url"
                    placeholder="Retailer URL"
                    required
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Target price"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={adding}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:col-span-4"
                  >
                    {adding ? "Adding..." : "Add to watchlist"}
                  </button>
                </form>
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      No items yet. Add your first product above.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.item_name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Current: ${item.current_price ?? "—"}
                            {item.target_price ? ` · Target: $${item.target_price}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRefresh(item.id)}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Refresh
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs text-zinc-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Tools tab ── */}
            {tab === "tools" && (
              <div>
                <div className="mb-5 grid gap-2 sm:grid-cols-3">
                  {TOOLS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setActiveTool(t.key);
                        setToolPrefill({});
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        activeTool === t.key
                          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${
                        activeTool === t.key
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-zinc-900 dark:text-zinc-50"
                      }`}>
                        {t.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                  {activeTool === "profit" && (
                    <ProfitCalculator
                      key={`profit-${toolPrefill.buy}-${toolPrefill.sell}-${toolPrefill.platform}`}
                      embedded
                      initialBuy={toolPrefill.buy}
                      initialSell={toolPrefill.sell}
                      initialPlatform={toolPrefill.platform}
                    />
                  )}
                  {activeTool === "listing" && (
                    <ListingGenerator
                      key={`listing-${toolPrefill.title}-${toolPrefill.buy}-${toolPrefill.platform}`}
                      embedded
                      initialTitle={toolPrefill.title}
                      initialBuy={toolPrefill.buy}
                      initialPlatform={toolPrefill.platform}
                    />
                  )}
                  {activeTool === "realestate" && <RealEstateCalculator embedded />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Plan</h2>
            <p className="mt-1.5 text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-50">
              {userData?.subscription_tier || "Free"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">My Deals</h2>
            <p className="mt-1.5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {myDeals.length} submitted · {myDeals.filter((d) => d.status === "approved").length} approved
            </p>
          </div>
          <Link
            href="/coupons"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:hover:bg-emerald-900/40"
          >
            <h2 className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Coupon Codes</h2>
            <p className="mt-1.5 text-lg font-semibold text-emerald-900 dark:text-emerald-300">Browse →</p>
          </Link>
        </div>

        {/* Niches */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your Niches</h2>
            <button
              onClick={saveNiches}
              disabled={savingNiches}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {savingNiches ? "Saving..." : "Save preferences"}
            </button>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Pick the categories you want deal alerts for. Leave all unchecked to receive every niche.
          </p>
          {availableNiches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading niches...</p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              {availableNiches.map((n) => {
                const selected = subscribedNiches.includes(n.key);
                return (
                  <button
                    key={n.key}
                    onClick={() => toggleNiche(n.key)}
                    title={n.description}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span className="mr-1">{n.emoji}</span>
                    {n.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Phone number for SMS alerts (Hunter tier) */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">SMS Alerts</h2>
            {(userData?.subscription_tier || "free").toLowerCase() !== "hunter" && (
              <Link href="/pricing" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Upgrade to Hunter →
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {(userData?.subscription_tier || "free").toLowerCase() === "hunter"
              ? "Enter your phone number to receive instant SMS deal alerts."
              : "SMS alerts are a Hunter plan feature. Upgrade to get instant deal notifications via text."}
          </p>
          <div className="mt-5 flex gap-3">
            <input
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={(userData?.subscription_tier || "free").toLowerCase() !== "hunter"}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              onClick={savePhone}
              disabled={savingPhone || (userData?.subscription_tier || "free").toLowerCase() !== "hunter"}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {savingPhone ? "Saving..." : phoneSaved ? "Saved!" : "Save number"}
            </button>
          </div>
        </div>

        {/* Notification settings link */}
        <Link
          href="/settings/notifications"
          className="mt-8 block rounded-2xl border border-blue-200 bg-blue-50 p-6 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:hover:bg-blue-900/40"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-blue-700 dark:text-blue-400">Notification Settings</h2>
              <p className="mt-1 text-sm text-blue-900 dark:text-blue-300">
                Manage alert channels, niches, and delivery preferences.
              </p>
            </div>
            <span className="text-2xl font-semibold text-blue-900 dark:text-blue-300">→</span>
          </div>
        </Link>
      </main>
    </div>
  );
}
