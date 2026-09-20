import { fetchSummary } from "@/lib/target-price";

// Yahoo 分析師預估：預估 EPS／營收、過去幾季實際 vs 預估、評等分布（非官方 API）
export type EstPeriod = {
  key: "0q" | "+1q" | "0y" | "+1y"; // 本季、下季、今年、明年
  endDate: string | null; // 該期結束日 YYYY-MM-DD
  eps: number | null; // 預估 EPS（分析師平均）
  epsLow: number | null;
  epsHigh: number | null;
  analysts: number | null; // 預估家數
  revenue: number | null; // 預估營收（元）
  growth: number | null; // 預估 EPS 相對去年同期的成長率（0.62 = 62%）
};

export type EstHistory = { quarter: string; actual: number | null; estimate: number | null };

export type Ratings = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type Estimates = { periods: EstPeriod[]; history: EstHistory[]; ratings: Ratings | null };

const TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Estimates | null }>();

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const raw = (v: unknown) => n((v as { raw?: unknown } | undefined)?.raw);
const day = (v: unknown) =>
  typeof v === "string" ? v : typeof (v as { fmt?: unknown })?.fmt === "string" ? (v as { fmt: string }).fmt : null;

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function getEstimates(code: string): Promise<Estimates | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let value: Estimates | null = null;
  try {
    const r = await fetchSummary(code, ["earningsTrend", "earningsHistory", "recommendationTrend"]);
    if (r) {
      const periods: EstPeriod[] = ((r.earningsTrend?.trend ?? []) as Any[])
        .filter((t) => ["0q", "+1q", "0y", "+1y"].includes(t.period))
        .map((t) => ({
          key: t.period,
          endDate: day(t.endDate),
          eps: raw(t.earningsEstimate?.avg),
          epsLow: raw(t.earningsEstimate?.low),
          epsHigh: raw(t.earningsEstimate?.high),
          analysts: raw(t.earningsEstimate?.numberOfAnalysts),
          revenue: raw(t.revenueEstimate?.avg),
          growth: raw(t.earningsEstimate?.growth) ?? raw(t.growth),
        }));
      const history: EstHistory[] = ((r.earningsHistory?.history ?? []) as Any[])
        .map((h) => ({ quarter: day(h.quarter) ?? "", actual: raw(h.epsActual), estimate: raw(h.epsEstimate) }))
        .filter((h) => h.quarter)
        .sort((a, b) => a.quarter.localeCompare(b.quarter));
      const cur = ((r.recommendationTrend?.trend ?? []) as Any[]).find((t) => t.period === "0m");
      const ratings: Ratings | null = cur
        ? {
            strongBuy: n(cur.strongBuy) ?? 0,
            buy: n(cur.buy) ?? 0,
            hold: n(cur.hold) ?? 0,
            sell: n(cur.sell) ?? 0,
            strongSell: n(cur.strongSell) ?? 0,
          }
        : null;
      const anything = periods.some((p) => p.eps !== null) || history.length > 0 || ratings !== null;
      value = anything ? { periods, history, ratings } : null;
    }
  } catch {
    // 失敗就回 null；短時間內不重試，避免打爆 Yahoo
  }
  cache.set(code, { at: Date.now() - (value === null ? TTL - 10 * 60 * 1000 : 0), value });
  return value;
}
