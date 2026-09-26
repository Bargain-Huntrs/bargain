"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPublicDealPriceHistory,
  type ArbitrageDeal,
  type DealPriceHistory,
} from "@/lib/api";

interface PriceHistoryChartProps {
  deal: ArbitrageDeal;
}

interface PricePoint {
  date: Date;
  price: number;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PriceHistoryChart({ deal }: PriceHistoryChartProps) {
  const buyPrice = deal.buy_price;
  const historicalAvg =
    deal.historical_avg && deal.historical_avg > 0 ? deal.historical_avg : null;
  const detectedAt = deal.detected_at || new Date().toISOString();

  const [history, setHistory] = useState<DealPriceHistory | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicDealPriceHistory(deal.id)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  // Real recorded points only — never synthesized.
  const points: PricePoint[] = useMemo(() => {
    const real = (history?.points || [])
      .filter((p) => p.t && p.price != null)
      .map((p) => ({ date: new Date(p.t as string), price: p.price }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    // Ensure the current price is the final point so the chart ends at reality.
    const last = real[real.length - 1];
    if (!last || Math.abs(last.price - buyPrice) > 0.001) {
      real.push({ date: new Date(), price: buyPrice });
    }
    return real;
  }, [history, buyPrice]);

  const hasRealHistory = points.length >= 2;

  const discount =
    historicalAvg && historicalAvg > buyPrice
      ? Math.round((1 - buyPrice / historicalAvg) * 100)
      : 0;

  // Lowest recorded price and how many days ago.
  const lowest = useMemo(() => {
    if (points.length === 0) return { price: buyPrice, daysAgo: 0 };
    let min = points[0];
    for (const p of points) if (p.price < min.price) min = p;
    const daysAgo = Math.round(
      (points[points.length - 1].date.getTime() - min.date.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return { price: min.price, daysAgo };
  }, [points, buyPrice]);

  // Volatility: average absolute percent change between recorded points.
  const volatility = useMemo(() => {
    if (points.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
      sum += Math.abs(points[i].price - points[i - 1].price) / points[i - 1].price;
    }
    return (sum / (points.length - 1)) * 100;
  }, [points]);

  const prediction =
    discount >= 40 ? "Likely to rise" : discount >= 20 ? "Stable" : "May drop further";

  // --- Chart geometry ---
  const width = 760;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 40, left: 64 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const spanMs =
    points.length >= 2
      ? Math.max(points[points.length - 1].date.getTime() - points[0].date.getTime(), 1)
      : 1;

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices, buyPrice, historicalAvg ?? buyPrice);
  const maxPrice = Math.max(...prices, buyPrice, historicalAvg ?? buyPrice);
  const yPad = (maxPrice - minPrice) * 0.1 || 1;
  const yMin = Math.max(0, minPrice - yPad);
  const yMax = maxPrice + yPad;

  const xFor = (d: Date) =>
    padding.left +
    ((d.getTime() - points[0].date.getTime()) / spanMs) * plotW;
  const yFor = (price: number) =>
    padding.top + plotH - ((price - yMin) / (yMax - yMin)) * plotH;

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(p.date).toFixed(2)} ${yFor(p.price).toFixed(2)}`
    )
    .join(" ");

  const avgY = historicalAvg ? yFor(historicalAvg) : null;
  const areaPath =
    avgY !== null && points.length >= 2
      ? `M ${xFor(points[0].date).toFixed(2)} ${avgY.toFixed(2)} ` +
        points
          .map((p) => `L ${xFor(p.date).toFixed(2)} ${yFor(p.price).toFixed(2)}`)
          .join(" ") +
        ` L ${xFor(points[points.length - 1].date).toFixed(2)} ${avgY.toFixed(2)} Z`
      : null;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const value = yMin + ((yMax - yMin) * i) / 4;
    return { value, y: yFor(value) };
  });

  const xLabels =
    points.length >= 2
      ? [
          { date: points[0].date, x: xFor(points[0].date) },
          {
            date: new Date(
              (points[0].date.getTime() + points[points.length - 1].date.getTime()) / 2
            ),
            x: padding.left + plotW / 2,
          },
          {
            date: points[points.length - 1].date,
            x: xFor(points[points.length - 1].date),
          },
        ]
      : [];

  const detectedDate = new Date(detectedAt);
  const showDetectedMarker =
    points.length >= 2 &&
    detectedDate >= points[0].date &&
    detectedDate <= points[points.length - 1].date;

  const trendColor =
    historicalAvg && buyPrice < historicalAvg ? "#10b981" : "#f59e0b";

  const isGoodDeal = discount >= 20;
  const recommendation =
    discount >= 40
      ? { label: "Buy now", color: "bg-emerald-600" }
      : discount >= 20
        ? { label: "Good deal", color: "bg-emerald-500" }
        : discount >= 10
          ? { label: "Fair price", color: "bg-amber-500" }
          : { label: "Wait for better", color: "bg-zinc-500" };

  const roi = deal.roi ?? 0;
  const netProfit = deal.net_profit ?? 0;
  const resalePotential =
    netProfit > 0 && roi >= 30
      ? { label: "High", color: "text-emerald-600 dark:text-emerald-400" }
      : netProfit > 0 && roi >= 10
        ? { label: "Moderate", color: "text-amber-600 dark:text-amber-400" }
        : { label: "Low", color: "text-zinc-500" };

  const riskLevel =
    volatility > 4
      ? { label: "High", color: "text-red-600 dark:text-red-400" }
      : volatility > 2
        ? { label: "Medium", color: "text-amber-600 dark:text-amber-400" }
        : { label: "Low", color: "text-emerald-600 dark:text-emerald-400" };

  const daysTracked =
    points.length >= 2
      ? Math.max(
          1,
          Math.round(
            (points[points.length - 1].date.getTime() - points[0].date.getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1
        )
      : 0;

  return (
    <div className="mt-6 space-y-6">
      {/* Chart card */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Price History</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {loaded && hasRealHistory
            ? `${points.length} recorded prices over ${daysTracked} day${daysTracked === 1 ? "" : "s"}`
            : loaded
              ? "Tracking started — recorded prices will appear here as our scanners check this item"
              : "Loading recorded prices…"}
        </p>

        {hasRealHistory && (
          <div className="mt-4 w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full"
              role="img"
              aria-label="Recorded price history chart"
            >
              {/* Gridlines + Y labels */}
              {gridLines.map((g, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={g.y}
                    x2={width - padding.right}
                    y2={g.y}
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-700"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 8}
                    y={g.y + 4}
                    textAnchor="end"
                    className="fill-zinc-400 text-[10px]"
                  >
                    ${g.value.toFixed(0)}
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {xLabels.map((l, i) => (
                <text
                  key={i}
                  x={l.x}
                  y={height - padding.bottom + 20}
                  textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
                  className="fill-zinc-400 text-[10px]"
                >
                  {formatDate(l.date)}
                </text>
              ))}

              {/* Savings zone (shaded area between line and average) */}
              {areaPath && historicalAvg && buyPrice < historicalAvg && (
                <path d={areaPath} fill={trendColor} opacity={0.12} />
              )}

              {/* Historical average dashed line */}
              {avgY !== null && historicalAvg && (
                <>
                  <line
                    x1={padding.left}
                    y1={avgY}
                    x2={width - padding.right}
                    y2={avgY}
                    stroke="#71717a"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={width - padding.right}
                    y={avgY - 6}
                    textAnchor="end"
                    className="fill-zinc-500 text-[10px] font-medium"
                  >
                    avg {formatCurrency(historicalAvg)}
                  </text>
                </>
              )}

              {/* Price line */}
              <path d={linePath} fill="none" stroke={trendColor} strokeWidth={2.5} />

              {/* Recorded points */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={xFor(p.date)}
                  cy={yFor(p.price)}
                  r={3}
                  fill={trendColor}
                  opacity={0.6}
                />
              ))}

              {/* Deal detected marker */}
              {showDetectedMarker && (
                <>
                  <line
                    x1={xFor(detectedDate)}
                    y1={padding.top}
                    x2={xFor(detectedDate)}
                    y2={height - padding.bottom}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <text
                    x={xFor(detectedDate)}
                    y={padding.top - 8}
                    textAnchor="middle"
                    className="fill-amber-500 text-[10px] font-semibold"
                  >
                    Deal detected
                  </text>
                </>
              )}

              {/* Current price point */}
              <circle
                cx={xFor(points[points.length - 1].date)}
                cy={yFor(buyPrice)}
                r={5}
                fill={trendColor}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={xFor(points[points.length - 1].date) - 8}
                y={yFor(buyPrice) - 10}
                textAnchor="end"
                className="fill-zinc-700 dark:fill-zinc-200 text-[11px] font-bold"
              >
                {formatCurrency(buyPrice)}
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* Price summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Current Price</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(buyPrice)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Typical Price</p>
          <p className="mt-1 text-2xl font-bold text-zinc-400">
            {historicalAvg ? formatCurrency(historicalAvg) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Price Drop</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              discount > 20 ? "text-red-500" : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {discount}%
          </p>
          {discount > 20 && (
            <span className="mt-1 inline-block rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              Big drop
            </span>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Lowest seen</p>
          <p className="mt-1 text-2xl font-bold text-zinc-700 dark:text-zinc-200">
            {formatCurrency(lowest.price)}
          </p>
          <p className="text-[10px] text-zinc-400">
            {lowest.daysAgo === 0 ? "today" : `${lowest.daysAgo}d ago`}
          </p>
        </div>
      </div>

      {/* Price prediction */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500">Price prediction</p>
        <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {prediction}
        </p>
      </div>

      {/* Price Analysis section */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Price Analysis</h2>

        <div className="mt-4 space-y-4">
          {/* Is this a good deal? */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <span className="text-sm text-zinc-500">Is this a good deal?</span>
            <span
              className={`text-sm font-bold ${
                isGoodDeal
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              {isGoodDeal ? "Yes" : "Not really"}
            </span>
          </div>

          {/* Buy recommendation */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <span className="text-sm text-zinc-500">Buy recommendation</span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-bold text-white ${recommendation.color}`}
            >
              {recommendation.label}
            </span>
          </div>

          {/* Resale potential */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <span className="text-sm text-zinc-500">
              Resale potential
              {netProfit > 0 && (
                <span className="ml-1 text-xs text-zinc-400">
                  ({formatCurrency(netProfit)} profit · {roi.toFixed(0)}% ROI)
                </span>
              )}
            </span>
            <span className={`text-sm font-bold ${resalePotential.color}`}>
              {resalePotential.label}
            </span>
          </div>

          {/* Risk level */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Risk level
              {hasRealHistory && (
                <span className="ml-1 text-xs text-zinc-400">
                  ({volatility.toFixed(1)}% volatility)
                </span>
              )}
            </span>
            <span className={`text-sm font-bold ${riskLevel.color}`}>{riskLevel.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
