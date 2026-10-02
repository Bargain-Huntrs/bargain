"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function pct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function num(v: string): number {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

type Tab = "mao" | "flip" | "rental" | "brrrr";

const TABS: { key: Tab; label: string }[] = [
  { key: "mao", label: "70% Rule / MAO" },
  { key: "flip", label: "Flip ROI" },
  { key: "rental", label: "Rental Yield" },
  { key: "brrrr", label: "BRRRR" },
];

const TAB_LABELS: Record<Tab, string> = {
  mao: "70% Rule / MAO",
  flip: "Flip ROI",
  rental: "Rental Yield",
  brrrr: "BRRRR",
};

// ─── Saved scenarios (localStorage — no account needed) ────────────────────

interface SavedScenario {
  id: string;
  name: string;
  tab: Tab;
  inputs: Record<string, string>;
  headline: string; // e.g. "MAO $170,000" or "CoC 18.2%"
  savedAt: string;
}

const SCEN_KEY = "bh-re-scenarios";

function loadScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SCEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistScenarios(list: SavedScenario[]) {
  try {
    localStorage.setItem(SCEN_KEY, JSON.stringify(list.slice(0, 25)));
  } catch {}
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RealEstateCalculator({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<Tab>("mao");

  // MAO tab state
  const [arv, setArv] = useState<string>("");
  const [comp1, setComp1] = useState<string>("");
  const [comp2, setComp2] = useState<string>("");
  const [comp3, setComp3] = useState<string>("");
  const [rehab, setRehab] = useState<string>("");
  const [rulePct, setRulePct] = useState<string>("70");
  const [assignmentFee, setAssignmentFee] = useState<string>("");
  const [desiredProfit, setDesiredProfit] = useState<string>("");
  const [maoSellPct, setMaoSellPct] = useState<string>("8");

  // Flip tab state
  const [buyPrice, setBuyPrice] = useState<string>("");
  const [flipRehab, setFlipRehab] = useState<string>("");
  const [holdMonths, setHoldMonths] = useState<string>("4");
  const [monthlyHolding, setMonthlyHolding] = useState<string>("");
  const [buyClosingPct, setBuyClosingPct] = useState<string>("3");
  const [sellClosingPct, setSellClosingPct] = useState<string>("8");
  const [salePrice, setSalePrice] = useState<string>("");
  const [loanLtvPct, setLoanLtvPct] = useState<string>("");
  const [loanPointsPct, setLoanPointsPct] = useState<string>("");
  const [loanRatePct, setLoanRatePct] = useState<string>("");

  // Rental tab state
  const [rentalPrice, setRentalPrice] = useState<string>("");
  const [rentalRehab, setRentalRehab] = useState<string>("");
  const [monthlyRent, setMonthlyRent] = useState<string>("");
  const [vacancyPct, setVacancyPct] = useState<string>("5");
  const [opexPct, setOpexPct] = useState<string>("40");

  // BRRRR tab state — buy, rehab, rent, refinance, repeat
  const [brPrice, setBrPrice] = useState<string>("");
  const [brRehab, setBrRehab] = useState<string>("");
  const [brRent, setBrRent] = useState<string>("");
  const [brArv, setBrArv] = useState<string>("");
  const [brRefiLtvPct, setBrRefiLtvPct] = useState<string>("75");
  const [brRefiRatePct, setBrRefiRatePct] = useState<string>("7");
  const [brClosingPct, setBrClosingPct] = useState<string>("3");
  const [brVacancyPct, setBrVacancyPct] = useState<string>("5");
  const [brOpexPct, setBrOpexPct] = useState<string>("40");

  const [copied, setCopied] = useState(false);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [scenarioName, setScenarioName] = useState("");

  // Load saved scenarios once (client-side only).
  useEffect(() => {
    setScenarios(loadScenarios());
  }, []);

  // ── MAO math ──────────────────────────────────────────────────────────────
  const mao = useMemo(() => {
    const comps = [comp1, comp2, comp3].map(num).filter((c) => c > 0);
    const compAvg = comps.length
      ? comps.reduce((s, c) => s + c, 0) / comps.length
      : 0;
    const effectiveArv = num(arv) || compAvg;
    const multiplier = num(rulePct) / 100;
    const repairs = num(rehab);
    const fee = num(assignmentFee);
    const targetProfit = num(desiredProfit);
    const sellCosts = (effectiveArv * num(maoSellPct)) / 100;
    // Two modes: fixed rule % (default) or desired-profit — when a target
    // profit is set, the offer is backed out of ARV − profit − costs.
    const ruleOffer =
      effectiveArv > 0 ? effectiveArv * multiplier - repairs - fee : 0;
    const profitOffer =
      effectiveArv > 0 && targetProfit > 0
        ? effectiveArv - sellCosts - repairs - fee - targetProfit
        : 0;
    const maxOffer = targetProfit > 0 ? profitOffer : ruleOffer;
    return {
      compAvg,
      effectiveArv,
      multiplier,
      repairs,
      fee,
      targetProfit,
      sellCosts,
      ruleOffer,
      profitOffer,
      maxOffer: Math.max(0, maxOffer),
      profitRoom: Math.max(
        0,
        effectiveArv - effectiveArv * multiplier - fee
      ),
      hasInput: effectiveArv > 0,
    };
  }, [arv, comp1, comp2, comp3, rehab, rulePct, assignmentFee, desiredProfit, maoSellPct]);

  // ── Flip math ─────────────────────────────────────────────────────────────
  const flip = useMemo(() => {
    const buy = num(buyPrice);
    const repairs = num(flipRehab);
    const hold = num(holdMonths) * num(monthlyHolding);
    const buyClosing = (buy * num(buyClosingPct)) / 100;
    const sale = num(salePrice);
    const sellCosts = (sale * num(sellClosingPct)) / 100;

    // Hard money financing — loan sized as % of ARV (expected sale price).
    // Blank LTV = all-cash deal.
    const ltv = num(loanLtvPct) / 100;
    const loan = sale * ltv;
    const pointsCost = (loan * num(loanPointsPct)) / 100;
    const interestCost =
      (loan * num(loanRatePct)) / 100 / 12 * num(holdMonths);

    const totalProjectCost =
      buy + repairs + hold + buyClosing + pointsCost + interestCost;
    const cashNeeded = Math.max(0, totalProjectCost - loan);
    const netProfit = sale - sellCosts - totalProjectCost;
    // Financed flips are judged on cash-on-cash return; all-cash on total invested.
    const cashInvested = loan > 0 ? cashNeeded : totalProjectCost;
    const roi = cashInvested > 0 ? (netProfit / cashInvested) * 100 : 0;
    const months = num(holdMonths);
    const annualizedRoi = months > 0 ? (roi / months) * 12 : roi;
    // Sale price where net profit = 0: sale(1 − sellPct) = totalProjectCost
    const sellDenom = 1 - num(sellClosingPct) / 100;
    const breakEven =
      sellDenom > 0 ? totalProjectCost / sellDenom : totalProjectCost;
    return {
      buy,
      repairs,
      hold,
      buyClosing,
      sale,
      sellCosts,
      loan,
      pointsCost,
      interestCost,
      totalProjectCost,
      cashNeeded,
      cashInvested,
      netProfit,
      roi,
      annualizedRoi,
      breakEven,
      hasInput: buy > 0 || sale > 0,
    };
  }, [buyPrice, flipRehab, holdMonths, monthlyHolding, buyClosingPct, sellClosingPct, salePrice, loanLtvPct, loanPointsPct, loanRatePct]);

  // ── Rental math ───────────────────────────────────────────────────────────
  const rental = useMemo(() => {
    const price = num(rentalPrice);
    const repairs = num(rentalRehab);
    const allIn = price + repairs;
    const rent = num(monthlyRent);
    const grossAnnual = rent * 12;
    const vacancy = (grossAnnual * num(vacancyPct)) / 100;
    const effective = grossAnnual - vacancy;
    const opex = (effective * num(opexPct)) / 100;
    const noi = effective - opex;
    const grossYield = allIn > 0 ? (grossAnnual / allIn) * 100 : 0;
    const capRate = allIn > 0 ? (noi / allIn) * 100 : 0;
    const monthlyCashFlow = noi / 12;
    const onePercentOk = allIn > 0 && rent >= allIn * 0.01;
    return {
      allIn,
      rent,
      grossAnnual,
      vacancy,
      effective,
      opex,
      noi,
      grossYield,
      capRate,
      monthlyCashFlow,
      onePercentOk,
      hasInput: allIn > 0 || rent > 0,
    };
  }, [rentalPrice, rentalRehab, monthlyRent, vacancyPct, opexPct]);

  // ── BRRRR math ────────────────────────────────────────────────────────────
  const brrrr = useMemo(() => {
    const price = num(brPrice);
    const repairs = num(brRehab);
    const buyClosing = (price * num(brClosingPct)) / 100;
    const allIn = price + repairs + buyClosing;
    const afterRepair = num(brArv);
    const rent = num(brRent);

    const grossAnnual = rent * 12;
    const vacancy = (grossAnnual * num(brVacancyPct)) / 100;
    const effective = grossAnnual - vacancy;
    const opex = (effective * num(brOpexPct)) / 100;
    const noi = effective - opex;

    // Refinance: new loan sized as LTV% of ARV. Cash pulled out is whatever
    // doesn't have to stay in the deal (assumes a cash purchase — typical for
    // distressed BRRRR buys).
    const refiLoan = (afterRepair * num(brRefiLtvPct)) / 100;
    const cashLeftInDeal = allIn - refiLoan;
    const cashBackOut = Math.max(0, refiLoan - allIn);

    // Post-refi payment: 30-yr amortization on the new loan.
    const r = num(brRefiRatePct) / 100 / 12;
    const n = 360;
    const monthlyPayment =
      r > 0 && refiLoan > 0
        ? (refiLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : refiLoan / n;
    const annualDebt = monthlyPayment * 12;
    const annualCashFlow = noi - annualDebt;

    // Cash-on-cash on money still in the deal. If refi returns all capital
    // (cashLeftInDeal <= 0), CoC is infinite — every dollar of flow is "free".
    const infiniteReturn = cashLeftInDeal <= 0 && afterRepair > 0 && allIn > 0;
    const coc = infiniteReturn
      ? Infinity
      : cashLeftInDeal > 0
        ? (annualCashFlow / cashLeftInDeal) * 100
        : 0;

    return {
      price,
      repairs,
      buyClosing,
      allIn,
      afterRepair,
      rent,
      noi,
      refiLoan,
      cashLeftInDeal,
      cashBackOut,
      monthlyPayment,
      annualCashFlow,
      infiniteReturn,
      coc,
      hasInput: price > 0 && afterRepair > 0,
    };
  }, [brPrice, brRehab, brRent, brArv, brRefiLtvPct, brRefiRatePct, brClosingPct, brVacancyPct, brOpexPct]);

  const hasInput =
    tab === "mao" ? mao.hasInput
    : tab === "flip" ? flip.hasInput
    : tab === "brrrr" ? brrrr.hasInput
    : rental.hasInput;

  // ── Scenario save / load / compare ────────────────────────────────────────

  function currentInputs(): Record<string, string> {
    if (tab === "mao") return { arv, comp1, comp2, comp3, rehab, rulePct, assignmentFee, desiredProfit, maoSellPct };
    if (tab === "flip") return { buyPrice, flipRehab, holdMonths, monthlyHolding, buyClosingPct, sellClosingPct, salePrice, loanLtvPct, loanPointsPct, loanRatePct };
    if (tab === "brrrr") return { brPrice, brRehab, brRent, brArv, brRefiLtvPct, brRefiRatePct, brClosingPct, brVacancyPct, brOpexPct };
    return { rentalPrice, rentalRehab, monthlyRent, vacancyPct, opexPct };
  }

  function headline(): string {
    if (tab === "mao") return `MAO ${fmt(mao.maxOffer)}`;
    if (tab === "flip") return `Net ${fmt(flip.netProfit)} · ROI ${pct(flip.roi)}`;
    if (tab === "brrrr")
      return brrrr.infiniteReturn
        ? `All capital back + ${fmt(brrrr.annualCashFlow)}/yr`
        : `CoC ${pct(brrrr.coc)} · left in ${fmt(brrrr.cashLeftInDeal)}`;
    return `Cap ${pct(rental.capRate)} · ${fmt(rental.monthlyCashFlow)}/mo`;
  }

  function saveScenario() {
    const name = scenarioName.trim() || `${TAB_LABELS[tab]} deal`;
    const next: SavedScenario[] = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.slice(0, 60),
        tab,
        inputs: currentInputs(),
        headline: headline(),
        savedAt: new Date().toISOString().slice(0, 10),
      },
      ...scenarios,
    ];
    setScenarios(next);
    persistScenarios(next);
    setScenarioName("");
  }

  function deleteScenario(id: string) {
    const next = scenarios.filter((s) => s.id !== id);
    setScenarios(next);
    persistScenarios(next);
  }

  function loadScenario(s: SavedScenario) {
    const i = s.inputs;
    setTab(s.tab);
    if (s.tab === "mao") {
      setArv(i.arv || ""); setComp1(i.comp1 || ""); setComp2(i.comp2 || ""); setComp3(i.comp3 || "");
      setRehab(i.rehab || ""); setRulePct(i.rulePct || "70");
      setAssignmentFee(i.assignmentFee || ""); setDesiredProfit(i.desiredProfit || ""); setMaoSellPct(i.maoSellPct || "8");
    } else if (s.tab === "flip") {
      setBuyPrice(i.buyPrice || ""); setFlipRehab(i.flipRehab || "");
      setHoldMonths(i.holdMonths || "4"); setMonthlyHolding(i.monthlyHolding || "");
      setBuyClosingPct(i.buyClosingPct || "3"); setSellClosingPct(i.sellClosingPct || "8");
      setSalePrice(i.salePrice || ""); setLoanLtvPct(i.loanLtvPct || "");
      setLoanPointsPct(i.loanPointsPct || ""); setLoanRatePct(i.loanRatePct || "");
    } else if (s.tab === "brrrr") {
      setBrPrice(i.brPrice || ""); setBrRehab(i.brRehab || ""); setBrRent(i.brRent || "");
      setBrArv(i.brArv || ""); setBrRefiLtvPct(i.brRefiLtvPct || "75");
      setBrRefiRatePct(i.brRefiRatePct || "7"); setBrClosingPct(i.brClosingPct || "3");
      setBrVacancyPct(i.brVacancyPct || "5"); setBrOpexPct(i.brOpexPct || "40");
    } else {
      setRentalPrice(i.rentalPrice || ""); setRentalRehab(i.rentalRehab || "");
      setMonthlyRent(i.monthlyRent || ""); setVacancyPct(i.vacancyPct || "5"); setOpexPct(i.opexPct || "40");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Report rows for copy/print — per active tab.
  function reportRows(): { label: string; value: string }[] {
    if (tab === "mao") {
      const rows = [
        { label: "After-Repair Value (ARV)", value: fmt(mao.effectiveArv) },
        { label: `Rule`, value: `${rulePct}% of ARV` },
        { label: "Rehab Estimate", value: fmt(mao.repairs) },
        { label: "Assignment Fee", value: fmt(mao.fee) },
        { label: "Max Allowable Offer", value: fmt(mao.maxOffer) },
      ];
      if (mao.targetProfit > 0) rows.push({ label: "Desired profit mode", value: fmt(mao.targetProfit) });
      return rows;
    }
    if (tab === "flip") {
      const rows = [
        { label: "Purchase Price", value: fmt(flip.buy) },
        { label: "Rehab", value: fmt(flip.repairs) },
        { label: "Holding Costs", value: fmt(flip.hold) },
        { label: "Sale Price", value: fmt(flip.sale) },
      ];
      if (flip.loan > 0) {
        rows.push(
          { label: "Loan Amount", value: fmt(flip.loan) },
          { label: "Points + Interest", value: fmt(flip.pointsCost + flip.interestCost) },
          { label: "Cash Needed", value: fmt(flip.cashNeeded) },
        );
      }
      rows.push(
        { label: "Total Project Cost", value: fmt(flip.totalProjectCost) },
        { label: "Break-even Sale", value: fmt(flip.breakEven) },
        { label: "Net Profit", value: fmt(flip.netProfit) },
        { label: `ROI${flip.loan > 0 ? " on cash" : ""}`, value: pct(flip.roi) },
      );
      return rows;
    }
    if (tab === "brrrr") {
      return [
        { label: "All-in Cost (buy + rehab + closing)", value: fmt(brrrr.allIn) },
        { label: "After-Repair Value", value: fmt(brrrr.afterRepair) },
        { label: `Refi Loan (${brRefiLtvPct}% LTV)`, value: fmt(brrrr.refiLoan) },
        { label: "Cash Left in Deal", value: fmt(Math.max(0, brrrr.cashLeftInDeal)) },
        { label: "Cash Back Out", value: fmt(brrrr.cashBackOut) },
        { label: "Monthly Payment (post-refi)", value: fmt(brrrr.monthlyPayment) },
        { label: "NOI", value: fmt(brrrr.noi) },
        { label: "Annual Cash Flow", value: fmt(brrrr.annualCashFlow) },
        {
          label: "Cash-on-Cash Return",
          value: brrrr.infiniteReturn ? "Infinite — all capital recovered" : pct(brrrr.coc),
        },
      ];
    }
    return [
      { label: "All-in Cost", value: fmt(rental.allIn) },
      { label: "Monthly Rent", value: fmt(rental.rent) },
      { label: "NOI", value: fmt(rental.noi) },
      { label: "Cap Rate", value: pct(rental.capRate) },
      { label: "Monthly Cash Flow", value: fmt(rental.monthlyCashFlow) },
    ];
  }

  function handleCopy() {
    const lines = [
      `BargainHuntrs Real Estate Deal Calculator — ${TAB_LABELS[tab]}`,
      ...reportRows().map((r) => `${r.label}: ${r.value}`),
      "",
      "Calculated at bargainhuntrs.com/tools/real-estate-calculator",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint() {
    window.print();
  }

  // Shared results-panel actions: copy, save-scenario, print report.
  function Actions() {
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <button
          onClick={handleCopy}
          disabled={!hasInput}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy results"}
        </button>
        <button
          onClick={handlePrint}
          disabled={!hasInput}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Print report
        </button>
      </div>
    );
  }

  function SaveBar() {
    if (!hasInput) return null;
    return (
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
        <input
          type="text"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveScenario()}
          placeholder="Name this scenario — e.g. “123 Oak St, 70% offer”"
          className={inputCls}
        />
        <button
          onClick={saveScenario}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Save scenario
        </button>
      </div>
    );
  }

  return (
    <>
        {!embedded && (
          <>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-6 py-14 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-5">
            Free Tool
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-[1.1]">
            Real Estate Deal Calculator
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Is that property a bargain? Run the 70% rule, flip ROI, or rental
            yield before you make an offer — the same math investors use on
            off-market and distressed deals.
          </p>
        </section>
          </>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <section className="px-6 pt-10">
          <div className="mx-auto max-w-5xl">
            <div className="flex gap-2 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    tab === t.key
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Calculator ───────────────────────────────────────────────── */}
        <section className="px-6 py-10">
          <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">

            {/* ══ MAO tab ══ */}
            {tab === "mao" && (
              <>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Deal Details</h2>
                  <div className="space-y-4">
                    <Field label="After-Repair Value — ARV ($)" required>
                      <input
                        type="number" inputMode="decimal" min="0" step="1000"
                        value={arv}
                        onChange={(e) => setArv(e.target.value)}
                        placeholder="300000"
                        className={inputCls}
                      />
                    </Field>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                        No ARV? Enter up to 3 comparable sale prices
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" inputMode="decimal" min="0" value={comp1} onChange={(e) => setComp1(e.target.value)} placeholder="Comp 1" className={inputCls} />
                        <input type="number" inputMode="decimal" min="0" value={comp2} onChange={(e) => setComp2(e.target.value)} placeholder="Comp 2" className={inputCls} />
                        <input type="number" inputMode="decimal" min="0" value={comp3} onChange={(e) => setComp3(e.target.value)} placeholder="Comp 3" className={inputCls} />
                      </div>
                      {mao.compAvg > 0 && (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Comp average: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(mao.compAvg)}</span>
                          {num(arv) === 0 && " — used as ARV"}
                        </p>
                      )}
                    </div>
                    <Field label="Rehab / Repair Estimate ($)" required>
                      <input
                        type="number" inputMode="decimal" min="0" step="1000"
                        value={rehab}
                        onChange={(e) => setRehab(e.target.value)}
                        placeholder="40000"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Rule %" hint="70% standard; use 75%+ in hot markets, 65% or less in slow ones">
                      <input
                        type="number" inputMode="decimal" min="0" max="100" step="1"
                        value={rulePct}
                        onChange={(e) => setRulePct(e.target.value)}
                        placeholder="70"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Assignment / Wholesale Fee ($)" hint="your profit if assigning the contract">
                      <input
                        type="number" inputMode="decimal" min="0" step="500"
                        value={assignmentFee}
                        onChange={(e) => setAssignmentFee(e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </Field>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                        Or back into the offer from a profit target
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Desired profit ($)</span>
                          <input type="number" inputMode="decimal" min="0" step="1000" value={desiredProfit} onChange={(e) => setDesiredProfit(e.target.value)} placeholder="30000" className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Selling costs %</span>
                          <input type="number" inputMode="decimal" min="0" step="0.5" value={maoSellPct} onChange={(e) => setMaoSellPct(e.target.value)} placeholder="8" className={inputCls} />
                        </label>
                      </div>
                      {mao.targetProfit > 0 && (
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                          Profit-target mode active — overrides the {rulePct}% rule
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Results</h2>
                    <Actions />
                  </div>

                  <div className={`rounded-xl p-5 mb-5 text-center ${mao.hasInput ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Max Allowable Offer
                    </p>
                    <p className={`mt-1 text-4xl font-black tabular-nums ${mao.hasInput ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                      {mao.hasInput ? fmt(mao.maxOffer) : "$0"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {mao.hasInput ? "Offer at or below this number" : "Enter ARV and rehab to calculate"}
                    </p>
                  </div>

                  <dl className="space-y-2.5 text-sm">
                    <Row label="After-Repair Value" value={fmt(mao.effectiveArv)} />
                    {mao.targetProfit > 0 ? (
                      <>
                        <Row label="− Selling costs" value={`- ${fmt(mao.sellCosts)}`} />
                        <Row label="− Desired profit" value={`- ${fmt(mao.targetProfit)}`} />
                        <Row label="− Rehab estimate" value={`- ${fmt(mao.repairs)}`} />
                        {mao.fee > 0 && <Row label="− Assignment fee" value={`- ${fmt(mao.fee)}`} />}
                        <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                        <Row label={`${rulePct}% rule offer`} value={fmt(mao.ruleOffer)} />
                      </>
                    ) : (
                      <>
                        <Row label={`× ${rulePct}% rule`} value={fmt(mao.effectiveArv * mao.multiplier)} />
                        <Row label="− Rehab estimate" value={`- ${fmt(mao.repairs)}`} />
                        {mao.fee > 0 && <Row label="− Assignment fee" value={`- ${fmt(mao.fee)}`} />}
                        <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                        <Row label="Investor profit room" value={fmt(mao.profitRoom)} />
                      </>
                    )}
                  </dl>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">The 70% rule</p>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                      MAO = ARV × {rulePct}% − repairs{mao.fee > 0 ? " − your fee" : ""}.
                      It leaves ~30% for the end buyer&apos;s profit, holding, and closing costs.
                      Go lower in uncertain markets — a deal that only works at 80% isn&apos;t a deal.
                    </p>
                  </div>
                  <SaveBar />
                </div>
              </>
            )}

            {/* ══ Flip tab ══ */}
            {tab === "flip" && (
              <>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Deal Details</h2>
                  <div className="space-y-4">
                    <Field label="Purchase Price ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="1000" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="170000" className={inputCls} />
                    </Field>
                    <Field label="Rehab Cost ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="1000" value={flipRehab} onChange={(e) => setFlipRehab(e.target.value)} placeholder="40000" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Holding Months">
                        <input type="number" inputMode="decimal" min="0" step="1" value={holdMonths} onChange={(e) => setHoldMonths(e.target.value)} placeholder="4" className={inputCls} />
                      </Field>
                      <Field label="Holding $ / month" hint="loan, utilities, taxes">
                        <input type="number" inputMode="decimal" min="0" step="50" value={monthlyHolding} onChange={(e) => setMonthlyHolding(e.target.value)} placeholder="800" className={inputCls} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Buying Closing %" hint="title, escrow">
                        <input type="number" inputMode="decimal" min="0" step="0.5" value={buyClosingPct} onChange={(e) => setBuyClosingPct(e.target.value)} placeholder="3" className={inputCls} />
                      </Field>
                      <Field label="Selling Costs %" hint="agent + closing">
                        <input type="number" inputMode="decimal" min="0" step="0.5" value={sellClosingPct} onChange={(e) => setSellClosingPct(e.target.value)} placeholder="8" className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Expected Sale Price ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="1000" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="300000" className={inputCls} />
                    </Field>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                        Hard money financing — leave LTV blank for all-cash
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">LTV % of ARV</span>
                          <input type="number" inputMode="decimal" min="0" max="100" step="1" value={loanLtvPct} onChange={(e) => setLoanLtvPct(e.target.value)} placeholder="70" className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Points %</span>
                          <input type="number" inputMode="decimal" min="0" step="0.5" value={loanPointsPct} onChange={(e) => setLoanPointsPct(e.target.value)} placeholder="2" className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Rate % / yr</span>
                          <input type="number" inputMode="decimal" min="0" step="0.5" value={loanRatePct} onChange={(e) => setLoanRatePct(e.target.value)} placeholder="12" className={inputCls} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Results</h2>
                    <Actions />
                  </div>

                  <div className={`rounded-xl p-5 mb-5 text-center ${flip.netProfit > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : flip.hasInput ? "bg-red-50 dark:bg-red-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Net Profit</p>
                    <p className={`mt-1 text-4xl font-black tabular-nums ${flip.netProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : flip.hasInput ? "text-red-600 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                      {flip.hasInput ? fmt(flip.netProfit) : "$0"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {flip.hasInput ? (flip.netProfit > 0 ? `ROI ${pct(flip.roi)} — ${pct(flip.annualizedRoi)} annualized` : "You'd lose money on this flip") : "Enter deal numbers to calculate"}
                    </p>
                  </div>

                  <dl className="space-y-2.5 text-sm">
                    <Row label="Purchase price" value={fmt(flip.buy)} />
                    <Row label="Rehab" value={`+ ${fmt(flip.repairs)}`} />
                    <Row label="Holding costs" value={`+ ${fmt(flip.hold)}`} />
                    <Row label="Buying closing costs" value={`+ ${fmt(flip.buyClosing)}`} />
                    {flip.loan > 0 && (
                      <>
                        <Row label="Points" value={`+ ${fmt(flip.pointsCost)}`} />
                        <Row label="Loan interest" value={`+ ${fmt(flip.interestCost)}`} />
                      </>
                    )}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                    <Row label="Total project cost" value={fmt(flip.totalProjectCost)} />
                    {flip.loan > 0 && (
                      <>
                        <Row label="Loan amount" value={`- ${fmt(flip.loan)}`} />
                        <Row label="Cash you need" value={fmt(flip.cashNeeded)} />
                      </>
                    )}
                    <Row label="Sale price" value={fmt(flip.sale)} />
                    <Row label="Selling costs" value={`- ${fmt(flip.sellCosts)}`} />
                  </dl>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Break-even sale price</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-300">
                      {flip.hasInput ? fmt(flip.breakEven) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                      Sell below this and you lose money. Most flippers want 15%+ ROI
                      minimum — under 10% one surprise wipes out the margin.
                    </p>
                  </div>
                  <SaveBar />
                </div>
              </>
            )}

            {/* ══ Rental tab ══ */}
            {tab === "rental" && (
              <>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Deal Details</h2>
                  <div className="space-y-4">
                    <Field label="Purchase Price ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="1000" value={rentalPrice} onChange={(e) => setRentalPrice(e.target.value)} placeholder="180000" className={inputCls} />
                    </Field>
                    <Field label="Rehab / Make-Ready ($)" hint="to get it rentable">
                      <input type="number" inputMode="decimal" min="0" step="1000" value={rentalRehab} onChange={(e) => setRentalRehab(e.target.value)} placeholder="15000" className={inputCls} />
                    </Field>
                    <Field label="Expected Monthly Rent ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="50" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="1800" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Vacancy %" hint="5–8% typical">
                        <input type="number" inputMode="decimal" min="0" step="1" value={vacancyPct} onChange={(e) => setVacancyPct(e.target.value)} placeholder="5" className={inputCls} />
                      </Field>
                      <Field label="Operating %" hint="taxes, insurance, repairs, mgmt">
                        <input type="number" inputMode="decimal" min="0" step="5" value={opexPct} onChange={(e) => setOpexPct(e.target.value)} placeholder="40" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Results</h2>
                    <Actions />
                  </div>

                  <div className={`rounded-xl p-5 mb-5 text-center ${rental.capRate >= 5 ? "bg-emerald-50 dark:bg-emerald-950/30" : rental.hasInput ? "bg-amber-50 dark:bg-amber-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cap Rate</p>
                    <p className={`mt-1 text-4xl font-black tabular-nums ${rental.hasInput ? (rental.capRate >= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-zinc-400 dark:text-zinc-500"}`}>
                      {rental.hasInput ? pct(rental.capRate) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {rental.hasInput
                        ? `${fmt(rental.monthlyCashFlow)}/mo unlevered cash flow`
                        : "Enter price and rent to calculate"}
                    </p>
                  </div>

                  <dl className="space-y-2.5 text-sm">
                    <Row label="All-in cost" value={fmt(rental.allIn)} />
                    <Row label="Gross annual rent" value={fmt(rental.grossAnnual)} />
                    <Row label="Vacancy loss" value={`- ${fmt(rental.vacancy)}`} />
                    <Row label="Operating expenses" value={`- ${fmt(rental.opex)}`} />
                    <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                    <Row label="Net operating income" value={fmt(rental.noi)} />
                    <Row label="Gross yield" value={pct(rental.grossYield)} />
                  </dl>

                  <div className={`mt-5 rounded-xl border p-4 ${rental.hasInput && rental.onePercentOk ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"}`}>
                    <p className={`text-xs font-medium uppercase tracking-wider ${rental.hasInput && rental.onePercentOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                      1% rule
                    </p>
                    <p className={`mt-1 text-xs leading-relaxed ${rental.hasInput && rental.onePercentOk ? "text-emerald-700/80 dark:text-emerald-400/70" : "text-amber-700/80 dark:text-amber-400/70"}`}>
                      {rental.hasInput
                        ? rental.onePercentOk
                          ? `Rent ≥ 1% of all-in cost — this passes the quick screen.`
                          : `Rent is under 1% of all-in cost — cash flow will be thin.`
                        : `Monthly rent ≥ 1% of total cost is the classic quick screen for rental deals.`}
                    </p>
                  </div>
                  <SaveBar />
                </div>
              </>
            )}

            {/* ══ BRRRR tab ══ */}
            {tab === "brrrr" && (
              <>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Buy + Rehab</h2>
                  <div className="space-y-4">
                    <Field label="Purchase Price ($)" required hint="BRRRR usually starts with a cash or hard-money buy">
                      <input type="number" inputMode="decimal" min="0" step="1000" value={brPrice} onChange={(e) => setBrPrice(e.target.value)} placeholder="140000" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Rehab Cost ($)" required>
                        <input type="number" inputMode="decimal" min="0" step="1000" value={brRehab} onChange={(e) => setBrRehab(e.target.value)} placeholder="35000" className={inputCls} />
                      </Field>
                      <Field label="Buy Closing %" hint="title, escrow">
                        <input type="number" inputMode="decimal" min="0" step="0.5" value={brClosingPct} onChange={(e) => setBrClosingPct(e.target.value)} placeholder="3" className={inputCls} />
                      </Field>
                    </div>
                    <Field label="After-Repair Value — ARV ($)" required hint="what it appraises for after rehab — drives the refi">
                      <input type="number" inputMode="decimal" min="0" step="1000" value={brArv} onChange={(e) => setBrArv(e.target.value)} placeholder="230000" className={inputCls} />
                    </Field>
                    <Field label="Expected Monthly Rent ($)" required>
                      <input type="number" inputMode="decimal" min="0" step="50" value={brRent} onChange={(e) => setBrRent(e.target.value)} placeholder="1900" className={inputCls} />
                    </Field>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                        Refinance — the cash-out at step 4
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Refi LTV % of ARV</span>
                          <input type="number" inputMode="decimal" min="0" max="100" step="1" value={brRefiLtvPct} onChange={(e) => setBrRefiLtvPct(e.target.value)} placeholder="75" className={inputCls} />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">Refi rate % / yr (30-yr)</span>
                          <input type="number" inputMode="decimal" min="0" step="0.25" value={brRefiRatePct} onChange={(e) => setBrRefiRatePct(e.target.value)} placeholder="7" className={inputCls} />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Vacancy %" hint="5–8% typical">
                        <input type="number" inputMode="decimal" min="0" step="1" value={brVacancyPct} onChange={(e) => setBrVacancyPct(e.target.value)} placeholder="5" className={inputCls} />
                      </Field>
                      <Field label="Operating %" hint="taxes, insurance, repairs, mgmt">
                        <input type="number" inputMode="decimal" min="0" step="5" value={brOpexPct} onChange={(e) => setBrOpexPct(e.target.value)} placeholder="40" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Results</h2>
                    <Actions />
                  </div>

                  <div className={`rounded-xl p-5 mb-5 text-center ${brrrr.hasInput ? (brrrr.infiniteReturn || brrrr.coc >= 8 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30") : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cash-on-Cash Return</p>
                    <p className={`mt-1 text-4xl font-black tabular-nums ${brrrr.hasInput ? (brrrr.infiniteReturn || brrrr.coc >= 8 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-zinc-400 dark:text-zinc-500"}`}>
                      {brrrr.hasInput ? (brrrr.infiniteReturn ? "∞" : pct(brrrr.coc)) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {brrrr.hasInput
                        ? brrrr.infiniteReturn
                          ? `${fmt(brrrr.cashBackOut)} back at refi — all capital recovered`
                          : `${fmt(brrrr.cashLeftInDeal)} still in the deal after refi`
                        : "Enter purchase, rehab, ARV and rent"}
                    </p>
                  </div>

                  <dl className="space-y-2.5 text-sm">
                    <Row label="All-in cost (buy + rehab + closing)" value={fmt(brrrr.allIn)} />
                    <Row label="After-repair value" value={fmt(brrrr.afterRepair)} />
                    <Row label={`Refi loan (${brRefiLtvPct}% of ARV)`} value={fmt(brrrr.refiLoan)} />
                    {brrrr.infiniteReturn ? (
                      <Row label="Cash back at refi" value={fmt(brrrr.cashBackOut)} />
                    ) : (
                      <Row label="Cash left in deal" value={fmt(Math.max(0, brrrr.cashLeftInDeal))} />
                    )}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                    <Row label="NOI" value={fmt(brrrr.noi)} />
                    <Row label={`Payment (${brRefiRatePct}%, 30-yr)`} value={`- ${fmt(brrrr.monthlyPayment)}/mo`} />
                    <Row label="Annual cash flow" value={fmt(brrrr.annualCashFlow)} />
                  </dl>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">How BRRRR works</p>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                      Buy under value, rehab, rent it out, refinance at the new appraised value,
                      pull your capital back, repeat. The deal is done right when the refi
                      returns most or all of your cash — an infinite cash-on-cash return is
                      the goal, not a fantasy.
                    </p>
                  </div>
                  <SaveBar />
                </div>
              </>
            )}
          </div>

          {/* ── Saved scenarios compare ────────────────────────────────── */}
          {scenarios.length > 0 && (
            <div className="mx-auto max-w-5xl mt-8">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Saved scenarios
                    <span className="ml-2 text-xs font-normal text-zinc-500">saved in this browser — compare deals side by side</span>
                  </h2>
                  <button
                    onClick={() => { setScenarios([]); persistScenarios([]); }}
                    className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                        <th className="pb-2 pr-3 font-medium">Scenario</th>
                        <th className="pb-2 pr-3 font-medium">Strategy</th>
                        <th className="pb-2 pr-3 font-medium">Result</th>
                        <th className="pb-2 pr-3 font-medium">Saved</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {scenarios.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2.5 pr-3 font-medium text-zinc-900 dark:text-zinc-50 max-w-[220px] truncate">{s.name}</td>
                          <td className="py-2.5 pr-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{TAB_LABELS[s.tab]}</td>
                          <td className="py-2.5 pr-3 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">{s.headline}</td>
                          <td className="py-2.5 pr-3 text-zinc-400 text-xs whitespace-nowrap">{s.savedAt}</td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => loadScenario(s)}
                              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mr-3"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => deleteScenario(s.id)}
                              className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        {!embedded && (
          <>
        {/* ── SEO content ──────────────────────────────────────────────── */}
        <section className="px-6 py-12 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl space-y-10">

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                How to Tell If a Property Is Actually a Bargain
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <p>
                  Retail deals are easy — a discount sticker tells you the savings. Real estate
                  has no sticker. Whether it&apos;s a bank REO, a wholesaler&apos;s assignment
                  contract, or a private sale, the only way to know if it&apos;s a deal is to
                  run the numbers. The three calculations above cover the three ways buyers
                  use bargain properties: <strong className="text-zinc-900 dark:text-zinc-50">flipping</strong>,{" "}
                  <strong className="text-zinc-900 dark:text-zinc-50">wholesaling</strong>, and{" "}
                  <strong className="text-zinc-900 dark:text-zinc-50">renting</strong>.
                </p>
                <p>
                  The <strong className="text-zinc-900 dark:text-zinc-50">70% rule</strong> is the
                  industry&apos;s quick screen for flips and wholesale deals. It says your maximum
                  allowable offer (MAO) is 70% of the after-repair value minus repair costs — the
                  remaining 30% covers the buyer&apos;s profit, holding costs, and closing fees.
                  A $300,000 ARV house needing $40,000 of work has a MAO of $170,000. If the seller
                  wants $200,000, there&apos;s no deal — no matter how good the neighborhood is.
                </p>
                <p>
                  For <strong className="text-zinc-900 dark:text-zinc-50">flips</strong>, the mistakes
                  are always in the hidden costs: loan payments while the house sits, utilities,
                  insurance on a vacant property, and the 6–8% that disappears to agents and closing
                  on the way out. A $60,000 spread between buy price and sale price can shrink to
                  $15,000 real profit once everything is counted.
                </p>
                <p>
                  For <strong className="text-zinc-900 dark:text-zinc-50">rentals</strong>, the cap
                  rate (NOI ÷ all-in cost) tells you the unlevered return. Most investors screen for
                  5%+ cap rate and use the 1% rule — monthly rent at least 1% of total cost — as a
                  first pass before doing deeper analysis.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                Where These Deals Come From
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                The best-priced properties rarely appear on the MLS — they&apos;re bank REO
                listings (HUD Home Store, HomePath, HomeSteps), auction platforms (Auction.com,
                Hubzu, Xome), wholesale assignment contracts, and leads pulled from county
                foreclosure and probate filings. Our{" "}
                <Link href="/real-estate" className="text-emerald-600 dark:text-emerald-400 underline">
                  real estate deals page
                </Link>{" "}
                breaks down each source and the tools pros use to find them.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                A Note on Estimates
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                This calculator is a screening tool, not an appraisal and not financial advice.
                ARV should come from real comparable sales; rehab estimates should come from a
                contractor walkthrough, not a guess. The numbers are only as good as what you
                put in — use them to decide which deals deserve a closer look, not to write
                offers blindly.
              </p>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-50 px-6 py-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white dark:text-zinc-900">
                Hunting retail deals too?
              </h2>
              <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-600 max-w-lg mx-auto">
                BargainHuntrs scans 500+ retailers for clearance deals and price glitches —
                the original bargain hunting, updated throughout the day.
              </p>
              <div className="mt-6">
                <Link
                  href="/deals"
                  className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Browse today&apos;s deals
                </Link>
              </div>
            </div>

          </div>
        </section>
          </>
        )}

        {/* ── Print-only analysis report ───────────────────────────────── */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .re-print-report, .re-print-report * { visibility: visible; }
            .re-print-report {
              position: absolute; inset: 0;
              padding: 40px; background: #fff; color: #18181b;
            }
          }
        `}</style>
        <div className="re-print-report hidden print:block" aria-hidden="true">
          <div style={{ borderBottom: "3px solid #10b981", paddingBottom: 12, marginBottom: 24 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#10b981", fontWeight: 700, margin: 0 }}>
              BargainHuntrs · Deal Analysis Report
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 2px" }}>{TAB_LABELS[tab]}</h1>
            <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
              {scenarioName.trim() || "Unnamed deal"} — generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {reportRows().map((r) => (
                <tr key={r.label}>
                  <td style={{ padding: "8px 0", borderBottom: "1px solid #e4e4e7", color: "#52525b" }}>{r.label}</td>
                  <td style={{ padding: "8px 0", borderBottom: "1px solid #e4e4e7", textAlign: "right", fontWeight: 600 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ fontSize: 11, color: "#a1a1aa", marginTop: 32, lineHeight: 1.6 }}>
            Screening analysis only — not an appraisal or financial advice. ARV should come from
            real comparable sales; rehab estimates from a contractor walkthrough. Verify all
            figures independently before writing an offer.
          </p>
          <p style={{ fontSize: 11, color: "#a1a1aa", marginTop: 8 }}>
            Free tool · bargainhuntrs.com/tools/real-estate-calculator
          </p>
        </div>
      </>
  );
}

// ─── Small UI helpers ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint && <span className="text-zinc-400 dark:text-zinc-600 font-normal"> — {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
