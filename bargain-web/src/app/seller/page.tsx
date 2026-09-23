"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  applyAsSeller,
  getSellerProfile,
  submitSellerCoupon,
  submitSellerPriceDrop,
  bulkSubmitSellerDeals,
  getSellerSubmissions,
  type SellerProfile,
} from "@/lib/api";

type Tab = "apply" | "coupons" | "price-drops" | "bulk" | "submissions";

export default function SellerPortalPage() {
  const router = useRouter();
  const { loading, idToken } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("apply");
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Apply form
  const [applyForm, setApplyForm] = useState({ store_name: "", website: "" });
  const [applying, setApplying] = useState(false);

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    title: "", url: "", retailer: "", coupon_code: "",
    discount_type: "percentage", discount_value: "", expires_at: "",
    category: "", description: "",
  });
  const [submittingCoupon, setSubmittingCoupon] = useState(false);

  // Price drop form
  const [priceDropForm, setPriceDropForm] = useState({
    title: "", url: "", retailer: "", original_price: "", sale_price: "",
    image_url: "", category: "", description: "",
  });
  const [submittingPriceDrop, setSubmittingPriceDrop] = useState(false);

  // Bulk form
  const [bulkText, setBulkText] = useState("");
  const [submittingBulk, setSubmittingBulk] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!idToken) return;
    try {
      const p = await getSellerProfile(idToken);
      setProfile(p);
      if (p.is_verified_seller) {
        setActiveTab("coupons");
        const subs = await getSellerSubmissions(idToken).catch(() => []);
        setSubmissions(subs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seller profile");
    }
  }, [idToken]);

  useEffect(() => {
    if (!loading) loadProfile();
  }, [loading, loadProfile]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setApplying(true);
    try {
      const result = await applyAsSeller(idToken, applyForm.store_name, applyForm.website);
      setProfile(result.profile);
      setSuccess("Seller account activated! You can now submit coupon codes and price drops.");
      setActiveTab("coupons");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  async function handleCouponSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setSubmittingCoupon(true);
    try {
      await submitSellerCoupon(idToken, {
        title: couponForm.title,
        url: couponForm.url,
        retailer: couponForm.retailer,
        coupon_code: couponForm.coupon_code,
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        expires_at: couponForm.expires_at || undefined,
        category: couponForm.category || undefined,
        description: couponForm.description || undefined,
      });
      setCouponForm({ title: "", url: "", retailer: "", coupon_code: "", discount_type: "percentage", discount_value: "", expires_at: "", category: "", description: "" });
      setSuccess("Coupon code submitted and live!");
      const subs = await getSellerSubmissions(idToken).catch(() => []);
      setSubmissions(subs);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit coupon");
    } finally {
      setSubmittingCoupon(false);
    }
  }

  async function handlePriceDropSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setSubmittingPriceDrop(true);
    try {
      await submitSellerPriceDrop(idToken, {
        title: priceDropForm.title,
        url: priceDropForm.url,
        retailer: priceDropForm.retailer,
        original_price: parseFloat(priceDropForm.original_price),
        sale_price: parseFloat(priceDropForm.sale_price),
        image_url: priceDropForm.image_url || undefined,
        category: priceDropForm.category || undefined,
        description: priceDropForm.description || undefined,
      });
      setPriceDropForm({ title: "", url: "", retailer: "", original_price: "", sale_price: "", image_url: "", category: "", description: "" });
      setSuccess("Price drop submitted and live!");
      const subs = await getSellerSubmissions(idToken).catch(() => []);
      setSubmissions(subs);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit price drop");
    } finally {
      setSubmittingPriceDrop(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setSubmittingBulk(true);
    try {
      const deals = JSON.parse(bulkText);
      if (!Array.isArray(deals)) throw new Error("Input must be a JSON array of deals");
      const result = await bulkSubmitSellerDeals(idToken, deals);
      setSuccess(`Submitted ${result.created} deals!${result.errors.length ? ` Errors: ${result.errors.join(", ")}` : ""}`);
      setBulkText("");
      const subs = await getSellerSubmissions(idToken).catch(() => []);
      setSubmissions(subs);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk submit. Make sure JSON is valid.");
    } finally {
      setSubmittingBulk(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  const isSeller = profile?.is_verified_seller;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Seller Portal</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Submit coupon codes and price drops directly to BargainHuntrs
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Seller status badge */}
        {isSeller && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-300">Verified Seller</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {profile?.seller_store_name} · {submissions.length} submissions
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        {isSeller && (
          <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
            {([
              { id: "coupons" as Tab, label: "Submit Coupon" },
              { id: "price-drops" as Tab, label: "Submit Price Drop" },
              { id: "bulk" as Tab, label: "Bulk Submit" },
              { id: "submissions" as Tab, label: "My Submissions" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Apply Form */}
        {!isSeller && (
          <div className="max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Become a Verified Seller</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Submit your coupon codes and price drops directly to our deal feed. Verified sellers get instant publishing — no moderation queue.
            </p>
            {!idToken ? (
              <button
                onClick={() => router.push("/login")}
                className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Sign in to apply
              </button>
            ) : (
            <form onSubmit={handleApply} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Store Name</label>
                <input
                  type="text"
                  required
                  value={applyForm.store_name}
                  onChange={(e) => setApplyForm({ ...applyForm, store_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Website</label>
                <input
                  type="url"
                  required
                  value={applyForm.website}
                  onChange={(e) => setApplyForm({ ...applyForm, website: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <button
                type="submit"
                disabled={applying}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {applying ? "Activating..." : "Activate Seller Account"}
              </button>
            </form>
            )}
          </div>
        )}

        {/* Coupon Form */}
        {isSeller && activeTab === "coupons" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Submit a Coupon Code</h2>
            <form onSubmit={handleCouponSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input type="text" placeholder="Title *" required value={couponForm.title} onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <input type="url" placeholder="Product URL *" required value={couponForm.url} onChange={(e) => setCouponForm({ ...couponForm, url: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <input type="text" placeholder="Retailer *" required value={couponForm.retailer} onChange={(e) => setCouponForm({ ...couponForm, retailer: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="text" placeholder="Coupon Code *" required value={couponForm.coupon_code} onChange={(e) => setCouponForm({ ...couponForm, coupon_code: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                <option value="percentage">Percentage Off</option>
                <option value="fixed">Fixed Amount Off</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
              <input type="number" step="0.01" placeholder="Discount Value *" required value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="date" placeholder="Expires At" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="text" placeholder="Category" value={couponForm.category} onChange={(e) => setCouponForm({ ...couponForm, category: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <textarea placeholder="Description" value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} rows={2} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <button type="submit" disabled={submittingCoupon} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:col-span-2">
                {submittingCoupon ? "Submitting..." : "Submit Coupon Code"}
              </button>
            </form>
          </div>
        )}

        {/* Price Drop Form */}
        {isSeller && activeTab === "price-drops" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Submit a Price Drop</h2>
            <form onSubmit={handlePriceDropSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input type="text" placeholder="Title *" required value={priceDropForm.title} onChange={(e) => setPriceDropForm({ ...priceDropForm, title: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <input type="url" placeholder="Product URL *" required value={priceDropForm.url} onChange={(e) => setPriceDropForm({ ...priceDropForm, url: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <input type="text" placeholder="Retailer *" required value={priceDropForm.retailer} onChange={(e) => setPriceDropForm({ ...priceDropForm, retailer: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="url" placeholder="Image URL" value={priceDropForm.image_url} onChange={(e) => setPriceDropForm({ ...priceDropForm, image_url: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="number" step="0.01" placeholder="Original Price *" required value={priceDropForm.original_price} onChange={(e) => setPriceDropForm({ ...priceDropForm, original_price: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="number" step="0.01" placeholder="Sale Price *" required value={priceDropForm.sale_price} onChange={(e) => setPriceDropForm({ ...priceDropForm, sale_price: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <input type="text" placeholder="Category" value={priceDropForm.category} onChange={(e) => setPriceDropForm({ ...priceDropForm, category: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
              <textarea placeholder="Description" value={priceDropForm.description} onChange={(e) => setPriceDropForm({ ...priceDropForm, description: e.target.value })} rows={2} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2" />
              <button type="submit" disabled={submittingPriceDrop} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:col-span-2">
                {submittingPriceDrop ? "Submitting..." : "Submit Price Drop"}
              </button>
            </form>
          </div>
        )}

        {/* Bulk Submit */}
        {isSeller && activeTab === "bulk" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bulk Submit Deals</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Paste a JSON array of deals. Each deal needs: title, url, retailer, original_price, sale_price. Optional: image_url, category, description.
            </p>
            <form onSubmit={handleBulkSubmit} className="mt-6">
              <textarea
                placeholder='[{"title":"PS5 Pro","url":"https://...","retailer":"Amazon","original_price":799,"sale_price":599}]'
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button type="submit" disabled={submittingBulk} className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                {submittingBulk ? "Submitting..." : "Bulk Submit"}
              </button>
            </form>
          </div>
        )}

        {/* My Submissions */}
        {isSeller && activeTab === "submissions" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My Submissions</h2>
            {submissions.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No submissions yet.</p>
            ) : (
              <div className="mt-6 space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{s.title}</p>
                      <p className="text-sm text-zinc-500">
                        {s.submission_type} · {s.retailer} · {s.status}
                      </p>
                    </div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700">
                      View →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
