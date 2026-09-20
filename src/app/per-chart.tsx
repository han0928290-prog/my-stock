"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, median, niceTicks, toNum, type LabelProps } from "./chart-utils";
import { fmt, getJson, tooltipStyle } from "./lib";

type PerPoint = { date: string; per: number | null };

// 近一年本益比走勢：單一折線，虛線標出一年中位數，方便判斷現在偏貴還是偏便宜
export default function PerChart({ code }: { code: string }) {
  const [rows, setRows] = useState<PerPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gradId = useId();

  useEffect(() => {
    getJson<{ data: PerPoint[] }>(`/api/finmind/per?code=${code}`)
      .then((r) => setRows(r.data))
      .catch((e: Error) => setError(e.message));
  }, [code]);

  const shell = (body: React.ReactNode) => (
    <div className="card p-5 sm:p-6">
      <div className="mb-3 font-bold">近一年本益比</div>
      {body}
    </div>
  );

  if (error) return shell(<p className="text-sm text-up">本益比資料載入失敗：{error}</p>);
  if (!rows) return <div className="card h-72 animate-pulse" />;

  const values = rows.map((r) => r.per).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return shell(<p className="text-sm text-muted">查無本益比資料（ETF、新上市或近期虧損的股票可能沒有）。</p>);
  }

  const last = rows.length - 1;
  const current = rows[last].per;
  const med = median(values);
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const ticks = niceTicks(lo, hi);
  const summary = `近一年本益比走勢圖，最新 ${current === null ? "無資料" : fmt(current, 1)}，一年中位數 ${fmt(med, 1)}，最高 ${fmt(hi, 1)}，最低 ${fmt(lo, 1)}。`;

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="font-bold">
          近一年本益比 <span className="ml-1 text-xs font-normal text-muted">FinMind・每日</span>
        </div>
        <dl className="flex gap-x-5 text-xs text-muted">
          {[
            ["目前", current],
            ["中位數", med],
            ["最高", hi],
            ["最低", lo],
          ].map(([label, v]) => (
            <div key={label as string} className="flex items-baseline gap-1.5">
              <dt>{label as string}</dt>
              <dd className="num text-sm font-semibold text-fg">{v === null ? "—" : fmt(v as number, 1)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="h-56" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 22, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={56}
              tickFormatter={(d: string) => `${d.slice(2, 4)}/${d.slice(5, 7)}`}
            />
            <YAxis
              width={40}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              ticks={ticks}
              interval={0}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              tickFormatter={(v: number) => String(v)}
            />
            <ReferenceLine y={med} stroke="var(--muted)" strokeOpacity={0.7} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row = (payload?.[0]?.payload ?? null) as PerPoint | null;
                if (!active || !row) return null;
                return (
                  <div style={tooltipStyle} className="px-3 py-2">
                    <div className="label mb-1">{row.date}</div>
                    <div className="num font-semibold">
                      本益比 {row.per === null ? "—" : fmt(row.per, 2)}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="per"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
              label={({ x, y, value, index }: LabelProps) =>
                index === last && typeof value === "number" ? (
                  <g>
                    <circle cx={toNum(x)} cy={toNum(y)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
                    <text x={toNum(x)} y={toNum(y) - 12} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--fg)">
                      {fmt(value, 1)}
                    </text>
                  </g>
                ) : (
                  <g />
                )
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">虛線為近一年中位數 {fmt(med, 1)}。虧損期間沒有本益比，線會中斷。</p>
    </div>
  );
}
