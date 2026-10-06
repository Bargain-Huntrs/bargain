"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getCurrentUser,
  getCrmStats,
  getCrmActivity,
  getCrmMembers,
  getCrmLeads,
  reviewCrmLead,
  getCrmTasks,
  createCrmActivity,
  completeCrmTask,
  getCrmPipeline,
  type CrmStats,
  type CrmActivityItem,
  type CrmMember,
  type CrmLead,
  type CrmTask,
  type CrmPipeline,
} from "@/lib/api";

type Tab = "overview" | "members" | "moderation" | "tasks";

export default function AdminCrmPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dataLoading, setDataLoading] = useState(false);

  const [stats, setStats] = useState<CrmStats | null>(null);
  const [activity, setActivity] = useState<CrmActivityItem[]>([]);
  const [pipeline, setPipeline] = useState<CrmPipeline | null>(null);
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);

  const [memberSearch, setMemberSearch] = useState("");
  const [memberTier, setMemberTier] = useState("");
  const [leadKind, setLeadKind] = useState<"" | "seller" | "community">("");
  const [leadStatus, setLeadStatus] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [taskBody, setTaskBody] = useState("");
  const [taskDue, setTaskDue] = useState("");

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
      .catch(() => router.push("/login"));
  }, [user, loading, idToken, router]);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const loadOverview = useCallback(async () => {
    if (!idToken) return;
    setDataLoading(true);
    clearMessages();
    try {
      const [s, a, p] = await Promise.all([
        getCrmStats(idToken),
        getCrmActivity(idToken),
        getCrmPipeline(idToken),
      ]);
      setStats(s);
      setActivity(a.recentActivity || []);
      setPipeline(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CRM overview");
    } finally {
      setDataLoading(false);
    }
  }, [idToken, clearMessages]);

  const loadMembers = useCallback(async () => {
    if (!idToken) return;
    setDataLoading(true);
    clearMessages();
    try {
      setMembers(await getCrmMembers(idToken, { tier: memberTier || undefined, search: memberSearch || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setDataLoading(false);
    }
  }, [idToken, memberTier, memberSearch, clearMessages]);

  const loadLeads = useCallback(async () => {
    if (!idToken) return;
    setDataLoading(true);
    clearMessages();
    try {
      setLeads(await getCrmLeads(idToken, { kind: leadKind || undefined, status: leadStatus || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setDataLoading(false);
    }
  }, [idToken, leadKind, leadStatus, clearMessages]);

  const loadTasks = useCallback(async () => {
    if (!idToken) return;
    setDataLoading(true);
    clearMessages();
    try {
      setTasks(await getCrmTasks(idToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setDataLoading(false);
    }
  }, [idToken, clearMessages]);

  useEffect(() => {
    if (!roleChecked || userRole !== "admin") return;
    if (activeTab === "overview") loadOverview();
    if (activeTab === "members") loadMembers();
    if (activeTab === "moderation") loadLeads();
    if (activeTab === "tasks") loadTasks();
  }, [activeTab, roleChecked, userRole, loadOverview, loadMembers, loadLeads, loadTasks]);

  // Debounced member search
  useEffect(() => {
    if (activeTab !== "members" || !roleChecked || userRole !== "admin") return;
    const t = setTimeout(() => loadMembers(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearch, memberTier]);

  async function handleReview(lead: CrmLead, action: "approve" | "reject") {
    if (!idToken) return;
    setActionLoading(lead.id);
    clearMessages();
    try {
      await reviewCrmLead(idToken, lead.kind, lead.id, action);
      setSuccess(`${lead.kind === "seller" ? "Seller submission" : "Community deal"} ${action}d.`);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCompleteTask(taskId: string) {
    if (!idToken) return;
    setActionLoading(taskId);
    clearMessages();
    try {
      await completeCrmTask(idToken, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !taskBody.trim()) return;
    setActionLoading("new-task");
    clearMessages();
    try {
      await createCrmActivity(idToken, {
        type: "task",
        body: taskBody.trim(),
        due_at: taskDue ? new Date(taskDue).toISOString() : undefined,
      });
      setTaskBody("");
      setTaskDue("");
      setSuccess("Task created.");
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !roleChecked) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-24 text-center text-zinc-500">Loading…</main>
        <Footer />
      </div>
    );
  }

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
    { key: "overview", label: "Overview" },
    { key: "members", label: "Members" },
    { key: "moderation", label: "Moderation" },
    { key: "tasks", label: "Tasks" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">CRM</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Member lifecycle, submission pipeline, and affiliate performance.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            ← Admin
          </Link>
        </div>

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

        {/* ── Overview ── */}
        {activeTab === "overview" && stats && (
          <div className="mt-6 space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[
                ["Members", stats.totalUsers],
                ["Paid members", stats.paidUsers],
                ["Signups this month", stats.signupsThisMonth],
                ["MoM growth", `${stats.monthlyGrowth}%`],
                ["Newsletter subs", stats.newsletterSubscribers],
                ["Live deals", stats.liveDeals],
                ["Active alerts", stats.activeAlerts],
                ["Tasks due", stats.tasksDue],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Affiliate clicks
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-800 dark:text-emerald-300">
                  {stats.affiliateClicks.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
                  {stats.conversions} conversions · {stats.conversionRate}%
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Commission earned
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-800 dark:text-emerald-300">
                  ${stats.commissionEarned.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Awaiting moderation
                </p>
                <p className="mt-2 text-3xl font-bold text-amber-800 dark:text-amber-300">
                  {stats.pendingSellerSubmissions + stats.pendingCommunityDeals}
                </p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                  {stats.pendingSellerSubmissions} seller · {stats.pendingCommunityDeals} community
                </p>
              </div>
            </div>

            {pipeline && (
              <div className="grid gap-4 sm:grid-cols-3">
                <MiniBreakdown title="Members by tier" data={pipeline.membersByTier} />
                <MiniBreakdown title="Deals by status" data={pipeline.dealsByStatus} />
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Clicks by retailer
                  </h3>
                  <div className="mt-3 space-y-1.5">
                    {pipeline.clicksByRetailer.slice(0, 6).map((r) => (
                      <div key={r.retailer} className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">{r.retailer}</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {r.clicks} · ${r.commission}
                        </span>
                      </div>
                    ))}
                    {pipeline.clicksByRetailer.length === 0 && (
                      <p className="text-sm text-zinc-500">No affiliate clicks yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activity.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Recent activity
                </h2>
                <div className="mt-3 space-y-2">
                  {activity.map((a) => (
                    <div
                      key={`${a.type}-${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300">
                        <span className="text-zinc-500">{a.title}:</span> {a.description}
                      </span>
                      {a.timestamp && (
                        <span className="text-xs text-zinc-400">
                          {new Date(a.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Members ── */}
        {activeTab === "members" && (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <select
                value={memberTier}
                onChange={(e) => setMemberTier(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">All tiers</option>
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="elite">elite</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Verified</th>
                    <th className="px-4 py-3">Alerts</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {m.name || m.email}
                        </span>
                        {m.name && (
                          <span className="block text-xs text-zinc-500">{m.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            m.tier !== "free"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {m.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {m.emailVerified ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {[m.emailAlerts && "email", m.smsAlerts && "sms"]
                          .filter(Boolean)
                          .join(" + ") || "off"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && !dataLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        No members match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Moderation ── */}
        {activeTab === "moderation" && (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap gap-3">
              <select
                value={leadKind}
                onChange={(e) => setLeadKind(e.target.value as typeof leadKind)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">All sources</option>
                <option value="seller">Seller submissions</option>
                <option value="community">Community deals</option>
              </select>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">All statuses</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
              <button
                onClick={loadLeads}
                disabled={dataLoading}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {dataLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="space-y-3">
              {leads.map((l) => (
                <div
                  key={`${l.kind}-${l.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          l.kind === "seller"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                        }`}
                      >
                        {l.kind}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {l.status}
                      </span>
                      {l.retailer && (
                        <span className="text-xs text-zinc-500">{l.retailer}</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener" className="hover:underline">
                          {l.title}
                        </a>
                      ) : (
                        l.title
                      )}
                    </p>
                  </div>
                  {l.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(l, "approve")}
                        disabled={actionLoading === l.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(l, "reject")}
                        disabled={actionLoading === l.id}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {leads.length === 0 && !dataLoading && (
                <p className="py-8 text-center text-sm text-zinc-500">No submissions.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {activeTab === "tasks" && (
          <div className="mt-6">
            <form onSubmit={handleAddTask} className="mb-6 flex flex-wrap gap-3">
              <input
                value={taskBody}
                onChange={(e) => setTaskBody(e.target.value)}
                placeholder="New task…"
                required
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={actionLoading === "new-task" || !taskBody.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Add
              </button>
            </form>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">{t.body}</p>
                    {t.dueAt && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Due {new Date(t.dueAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCompleteTask(t.id)}
                    disabled={actionLoading === t.id}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Complete
                  </button>
                </div>
              ))}
              {tasks.length === 0 && !dataLoading && (
                <p className="py-8 text-center text-sm text-zinc-500">No open tasks.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function MiniBreakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      <div className="mt-3 space-y-1.5">
        {entries.slice(0, 6).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{k}</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{v}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-zinc-500">No data</p>}
      </div>
    </div>
  );
}
