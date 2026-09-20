"use client";

import type { EstPeriod, Estimates } from "@/lib/estimates";
import { fmt, trendColor } from "./lib";

const LABELS: Record<EstPeriod["key"], string> = { "0q": "本季", "+1q": "下季", "0y": "今年", "+1y": "明年" };

const quarter = (d: string) => `${d.slice(0, 4)} Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;

const periodName = (p: EstPeriod) => {
  const suffix = p.endDate ? (p.key.endsWith("q") ? quarter(p.endDate) : p.endDate.slice(0, 4)) : "";
  return `${LABELS[p.key]}${suffix ? `（${suffix}）` : ""}`;
};

// 評等分布：由強烈買進到強烈賣出的有序量表，買方偏紅、賣方偏綠、持有為灰（台股慣例）
const RATING_STEPS = [
  { key: "strongBuy", label: "強力買進", bg: "bg-up", ink: "text-up" },
  { key: "buy", label: "買進", bg: "bg-up/55", ink: "text-up" },
  { key: "hold", label: "持有", bg: "bg-muted/45", ink: "text-muted" },
  { key: "sell", label: "賣出", bg: "bg-down/55", ink: "text-down" },
  { key: "strongSell", label: "強力賣出", bg: "bg-down", ink: "text-down" },
] as const;

type Props = {
  est: Estimates;
  latestActualDate: string | null; // 最新一季已公布財報的季末日；預估期間若早於或等於這天就是過期資料
};

export default function EstimatesCard({ est, latestActualDate }: Props) {
  // 季度預估若「該季已經公布財報」就不再是預測，跳過；年度預估保留
  const periods = est.periods.filter(
    (p) => p.eps !== null && !(p.key.endsWith("q") && latestActualDate && p.endDate && p.endDate <= latestActualDate),
  );
  const history = est.history.filter((h) => h.actual !== null && h.estimate !== null).slice(-4);
  const fewAnalysts = periods.some((p) => (p.analysts ?? 0) > 0 && (p.analysts ?? 0) <= 2);
  const r = est.ratings;
  const total = r ? r.strongBuy + r.buy + r.hold + r.sell + r.strongSell : 0;

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="font-bold">
          分析師預估 <span className="ml-1 text-xs font-normal text-muted">Yahoo Finance</span>
        </div>
      </div>

      {periods.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">期間</th>
                <th className="px-3 py-2 text-right font-medium">預估 EPS（元）</th>
                <th className="px-3 py-2 text-right font-medium">區間</th>
                <th className="px-3 py-2 text-right font-medium">家數</th>
                <th className="px-3 py-2 text-right font-medium">預估營收（億）</th>
                <th className="py-2 pl-3 text-right font-medium">EPS 年增</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.key} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3">{periodName(p)}</td>
                  <td className="num px-3 py-2.5 text-right font-semibold">{fmt(p.eps, 2)}</td>
                  <td className="num px-3 py-2.5 text-right text-muted">
                    {p.epsLow !== null && p.epsHigh !== null ? `${fmt(p.epsLow, 2)} ~ ${fmt(p.epsHigh, 2)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`num ${
                        (p.analysts ?? 0) <= 2 ? "rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600" : ""
                      }`}
                    >
                      {p.analysts ?? "—"}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right">{p.revenue === null ? "—" : fmt(p.revenue / 1e8, 1)}</td>
                  <td className={`num py-2.5 pl-3 text-right ${trendColor(p.growth)}`}>
                    {p.growth === null ? "—" : `${p.growth > 0 ? "+" : ""}${fmt(p.growth * 100, 1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fewAnalysts && (
        <p className="mt-2 text-xs text-amber-600">
          橘色標示的期間只有 1 到 2 家分析師預估，這個數字可能只是單一家的看法，參考價值有限。
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <div className="label mb-2">近 {history.length} 季 實際 vs 預估 EPS</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {history.map((h) => {
              const diff = ((h.actual as number) - (h.estimate as number)) / Math.abs(h.estimate as number || 1);
              const beat = diff > 0.005;
              const miss = diff < -0.005;
              return (
                <div key={h.quarter} className="rounded-xl border border-line px-3.5 py-3">
                  <div className="text-xs text-muted">{quarter(h.quarter)}</div>
                  <div className="num mt-1 text-sm">
                    <span className="font-semibold">{fmt(h.actual, 2)}</span>
                    <span className="text-muted"> / 預估 {fmt(h.estimate, 2)}</span>
                  </div>
                  <div className={`num mt-1 text-xs font-medium ${beat ? "text-up" : miss ? "text-down" : "text-muted"}`}>
                    {beat ? "▲ 優於預期" : miss ? "▼ 低於預期" : "符合預期"} {fmt(Math.abs(diff) * 100, 1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {r && total > 0 && (
        <div className="mt-6">
          <div className="label mb-2">分析師評等（共 {total} 家）</div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={RATING_STEPS.map((s) => `${s.label} ${r[s.key]} 家`).join("，")}>
            {RATING_STEPS.map((s) =>
              r[s.key] > 0 ? <div key={s.key} className={s.bg} style={{ width: `${(r[s.key] / total) * 100}%` }} /> : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {RATING_STEPS.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 rounded-sm ${s.bg}`} />
                {s.label} <span className="num font-semibold text-fg">{r[s.key]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        預估為分析師共識，可能有誤，僅供參考。Yahoo 的資料更新可能落後，已公布財報的季度不會再列為預估。
      </p>
    </div>
  );
}
