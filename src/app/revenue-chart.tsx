"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, niceTicks, toNum, type LabelProps } from "./chart-utils";
import { fmt, getJson, tooltipStyle, trendColor } from "./lib";

type Point = { ym: string; revenue: number; yoy: number | null };

// 兩張圖的邊界一致，月份才會上下對齊
const MARGIN = { top: 22, right: 12, bottom: 8, left: 0 };
const Y_WIDTH = 46;

const yi = (n: number) => n / 1e8; // 元 → 億
const monthLabel = (ym: string) => `${ym.slice(2, 4)}/${ym.slice(5, 7)}`;

type TipProps = { active?: boolean; payload?: readonly { payload?: Point }[] };

function Tip({ active, payload, kind }: TipProps & { kind: "rev" | "yoy" }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="label mb-1">{p.ym.replace("-", " 年 ") + " 月"}</div>
      <div className="num font-semibold">
        {kind === "rev"
          ? `營收 ${fmt(yi(p.revenue), 2)} 億`
          : `年增率 ${p.yoy === null ? "—" : (p.yoy > 0 ? "+" : "") + fmt(p.yoy, 1) + "%"}`}
      </div>
    </div>
  );
}

// 月營收（長條）與年增率（折線）：上下兩張圖共用月份橫軸，不做雙 Y 軸
export default function RevenueChart({ code }: { code: string }) {
  const [data, setData] = useState<Point[] | null>(null);
  const [ytd, setYtd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ data: Point[]; ytdYoy: number | null }>(`/api/finmind/revenue?code=${code}`)
      .then((r) => {
        setData(r.data);
        setYtd(r.ytdYoy);
      })
      .catch((e: Error) => setError(e.message));
  }, [code]);

  if (error) {
    return (
      <div className="card p-5 sm:p-6">
        <div className="mb-2 font-bold">月營收</div>
        <p className="text-sm text-up">月營收載入失敗：{error}</p>
      </div>
    );
  }
  if (!data) return <div className="card h-96 animate-pulse" />;
  if (data.length < 2) {
    return (
      <div className="card p-5 sm:p-6">
        <div className="mb-2 font-bold">月營收</div>
        <p className="text-sm text-muted">查無月營收資料（ETF 或新上市股票可能沒有）。</p>
      </div>
    );
  }

  const last = data.length - 1;
  const latest = data[last];
  const yoyVals = data.map((d) => d.yoy).filter((v): v is number => v !== null);
  const yTicks = yoyVals.length ? niceTicks(Math.min(0, ...yoyVals), Math.max(0, ...yoyVals), 4) : [0];
  const sign = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${fmt(v, 1)}%`);
  const summary = `近 ${data.length} 個月月營收長條圖與年增率折線圖，最新 ${latest.ym} 月營收 ${fmt(yi(latest.revenue), 2)} 億，年增率 ${sign(latest.yoy)}。`;

  return (
    <div className="card p-5 sm:p-6" role="img" aria-label={summary}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="font-bold">
          月營收 <span className="ml-1 text-xs font-normal text-muted">FinMind・近 {data.length} 個月</span>
        </div>
        <dl className="flex gap-x-5 text-xs text-muted">
          <div className="flex items-baseline gap-1.5">
            <dt>{latest.ym.slice(5)} 月營收</dt>
            <dd className="num text-sm font-semibold text-fg">{fmt(yi(latest.revenue), 2)} 億</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>年增</dt>
            <dd className={`num text-sm font-semibold ${trendColor(latest.yoy)}`}>{sign(latest.yoy)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>累計年增</dt>
            <dd className={`num text-sm font-semibold ${trendColor(ytd)}`}>{sign(ytd)}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-1)" }} />
        營收（億元）
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map((d) => ({ ...d, rev: yi(d.revenue) }))} margin={MARGIN} syncId={`rev-${code}`} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="ym" hide />
            <YAxis
              width={Y_WIDTH}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              interval={0}
              tickFormatter={(v: number) => fmt(v, v % 1 === 0 ? 0 : 1)}
            />
            <Tooltip cursor={{ fill: "var(--line)", opacity: 0.6 }} content={(p) => <Tip {...(p as TipProps)} kind="rev" />} />
            <Bar
              dataKey="rev"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
              label={({ x, y, width, value, index }: LabelProps) =>
                index === last && typeof value === "number" ? (
                  <text x={toNum(x) + toNum(width) / 2} y={toNum(y) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--fg)">
                    {fmt(value, 1)}
                  </text>
                ) : (
                  <g />
                )
              }
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-1 mt-4 flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="flex items-center">
          <span className="h-0.5 w-3" style={{ background: "var(--chart-2)" }} />
          <span className="-ml-1.5 h-2 w-2 rounded-full" style={{ background: "var(--chart-2)", boxShadow: "0 0 0 2px var(--surface)" }} />
        </span>
        年增率（%）
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={MARGIN} syncId={`rev-${code}`}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="ym"
              scale="band"
              tickFormatter={monthLabel}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={22}
            />
            <YAxis
              width={Y_WIDTH}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              ticks={yTicks}
              interval={0}
              domain={[yTicks[0], yTicks[yTicks.length - 1]]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.6} />
            <Tooltip cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} content={(p) => <Tip {...(p as TipProps)} kind="yoy" />} />
            <Line
              type="monotone"
              dataKey="yoy"
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 3.5, fill: "var(--chart-2)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--chart-2)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={({ x, y, value, index }: LabelProps) =>
                index === last && typeof value === "number" ? (
                  <text x={toNum(x)} y={toNum(y) - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--fg)">
                    {value > 0 ? "+" : ""}
                    {fmt(value, 1)}%
                  </text>
                ) : (
                  <g />
                )
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">年增率 = 與去年同月相比；累計年增 = 今年已公布月份合計 vs 去年同期。</p>
    </div>
  );
}
