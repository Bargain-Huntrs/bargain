"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getCurrentUser,
  getCommunityDeals,
  moderateCommunityDeal,
  getVoucherWinners,
  runVoucherDraw,
  markVoucherPaid,
  getCommunityStats,
  type CommunityDeal,
  type CommunityStats,
} from "@/lib/api";

type Tab = "pending" | "voucher" | "stats";

interface VoucherWinner {
  id: string;
  month: string;
  user_name: string;
  aura_points_at_draw: number;
  drawn_at: string;
  status: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pending deals state
  const [pendingDeals, setPendingDeals] = useState<CommunityDeal[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Voucher state
  const [winners, setWinners] = useState<VoucherWinner[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Check auth and role
  useEffect(() => {
    if (loading) return;
    if (!user || !idToken) {
      router.push("/login");
      return;
    }
    getCurrentUser(idToken)
      .then((data) => {
        setUserRole(data.role || "customer");
        setRoleChecked(true);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [user, loading, idToken, router]);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  // Load pending deals
  const loadPendingDeals = useCallback(async () => {
    if (!idToken) return;
    setPendingLoading(true);
    clearMessages();
    try {
      const data = await getCommunityDeals(idToken, { status: "pending", limit: 100 });
      setPendingDeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending deals");
    } finally {
      setPendingLoading(false);
    }
  }, [idToken, clearMessages]);

  // Load voucher winners
  const loadWinners = useCallback(async () => {
    if (!idToken) return;
    setWinnersLoading(true);
    clearMessages();
    try {
      const data = await getVoucherWinners(idToken);
      setWinners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load voucher winners");
    } finally {
      setWinnersLoading(false);
    }
  }, [idToken, clearMessages]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!idToken) return;
    setStatsLoading(true);
    clearMessages();
    try {
      const data = await getCommunityStats(idToken);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community stats");
    } finally {
      setStatsLoading(false);
    }
  }, [idToken, clearMessages]);

  // Load data when tab changes
  useEffect(() => {
    if (!roleChecked || userRole !== "admin") return;
    if (activeTab === "pending") loadPendingDeals();
    if (activeTab === "voucher") loadWinners();
    if (activeTab === "stats") loadStats();
  }, [activeTab, roleChecked, userRole, loadPendingDeals, loadWinners, loadStats]);

  async function handleApprove(dealId: string) {
    if (!idToken) return;
    setActionLoading(dealId);
    clearMessages();
    try {
      await moderateCommunityDeal(idToken, dealId, "approved");
      setSuccess(`Deal approved and promoted to main feed.`);
      setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve deal");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(dealId: string) {
    if (!idToken) return;
    setActionLoading(dealId);
    clearMessages();
    try {
      await moderateCommunityDeal(idToken, dealId, "rejected", rejectReason || undefined);
      setSuccess("Deal rejected.");
      setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
      setRejectingId(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject deal");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDraw() {
    if (!idToken) return;
    setDrawLoading(true);
    clearMessages();
    try {
      const result = await runVoucherDraw(idToken);
      setSuccess(`Voucher draw complete! Winner: ${result.winner.user_name} (${result.winner.aura_points_at_draw} Aura)`);
      await loadWinners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run voucher draw");
    } finally {
      setDrawLoading(false);
    }
  }

  async function handleMarkPaid(winnerId: string) {
    if (!idToken) return;
    setPaidLoading(winnerId);
    clearMessages();
    try {
      await markVoucherPaid(idToken, winnerId);
      setSuccess("Winner marked as paid.");
      await loadWinners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark winner as paid");
    } finally {
      setPaidLoading(null);
    }
  }

  // Loading state
  if (loading || !roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  // Access denied
  if (userRole !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-24">
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Access Denied</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              You need admin privileges to view this page.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pending Deals" },
    { key: "voucher", label: "Voucher Draw" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Moderate community deals, run voucher draws, and view community stats.
            </p>
          </div>
          <Link
            href="/admin/crm"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            CRM →
          </Link>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            {success}
          </div>
        )}

        {/* Pending Deals Tab */}
        {activeTab === "pending" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Pending Deals {pendingDeals.length > 0 && `(${pendingDeals.length})`}
              </h2>
              <button
                onClick={loadPendingDeals}
                disabled={pendingLoading}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {pendingLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {pendingLoading && pendingDeals.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading pending deals...</p>
              </div>
            ) : pendingDeals.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending deals to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {deal.image_url && (
                        <img
                          src={deal.image_url}
                          alt={deal.title}
                          className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{deal.title}</h3>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                            {deal.retailer}
                          </span>
                          {deal.category && (
                            <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                              {deal.category}
                            </span>
                          )}
                          {deal.original_price && (
                            <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                              Original: ${deal.original_price.toFixed(2)}
                            </span>
                          )}
                          {deal.sale_price && (
                            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                              Sale: ${deal.sale_price.toFixed(2)}
                            </span>
                          )}
                          {deal.discount_percent && (
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              {deal.discount_percent}% off
                            </span>
                          )}
                        </div>
                        {deal.description && (
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{deal.description}</p>
                        )}
                        <a
                          href={deal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View deal →
                        </a>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      {rejectingId === deal.id ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            placeholder="Rejection reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReject(deal.id)}
                              disabled={actionLoading === deal.id}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionLoading === deal.id ? "Rejecting..." : "Confirm Reject"}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(deal.id)}
                            disabled={actionLoading === deal.id}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {actionLoading === deal.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectingId(deal.id)}
                            disabled={actionLoading === deal.id}
                            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Voucher Draw Tab */}
        {activeTab === "voucher" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Voucher Draw</h2>
              <div className="flex gap-2">
                <button
                  onClick={loadWinners}
                  disabled={winnersLoading}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {winnersLoading ? "Loading..." : "Refresh"}
                </button>
                <button
                  onClick={handleDraw}
                  disabled={drawLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {drawLoading ? "Drawing..." : "Run Monthly Draw"}
                </button>
              </div>
            </div>

            {winnersLoading && winners.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading winners...</p>
              </div>
            ) : winners.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No voucher draws yet. Run the monthly draw to pick a winner.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Month</th>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Winner</th>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Aura at Draw</th>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Drawn At</th>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Status</th>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {winners.map((w) => (
                      <tr key={w.id} className="text-zinc-700 dark:text-zinc-300">
                        <td className="px-4 py-3 font-medium">{w.month}</td>
                        <td className="px-4 py-3">{w.user_name || "Unknown"}</td>
                        <td className="px-4 py-3">{w.aura_points_at_draw}</td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {w.drawn_at ? new Date(w.drawn_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              w.status === "paid"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {w.status === "pending" ? (
                            <button
                              onClick={() => handleMarkPaid(w.id)}
                              disabled={paidLoading === w.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {paidLoading === w.id ? "..." : "Mark Paid"}
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Community Stats</h2>
              <button
                onClick={loadStats}
                disabled={statsLoading}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {statsLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {statsLoading && !stats ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading stats...</p>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Stat cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Members</p>
                    <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-50">{stats.total_members}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deals Posted</p>
                    <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-50">{stats.deals_posted}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deals Today</p>
                    <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-50">{stats.deals_today}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Votes Today</p>
                    <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-50">{stats.votes_today}</p>
                  </div>
                </div>

                {/* Top hunter */}
                {stats.top_hunter && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Top Hunter</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <div>
                        <p className="text-xl font-bold text-amber-900 dark:text-amber-300">{stats.top_hunter.name}</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">{stats.top_hunter.aura_points} Aura points</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Last voucher winner */}
                {stats.last_voucher_winner && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Last Voucher Winner</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-2xl">🎁</span>
                      <div>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{stats.last_voucher_winner.user_name}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {stats.last_voucher_winner.month} — {stats.last_voucher_winner.aura_points_at_draw} Aura at draw
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
