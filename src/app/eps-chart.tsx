"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, toNum, type LabelProps } from "./chart-utils";
import { fmt, tooltipStyle } from "./lib";

export type EpsChartRow = {
  date: string; // 季末日 YYYY-MM-DD
  eps: number | null;
  grossMargin: number | null;
  // 分析師預估季：長條用淺色虛線框，沒有毛利率
  estimate?: boolean;
  epsLow?: number | null;
  epsHigh?: number | null;
  analysts?: number | null;
};

// 兩張圖的左右邊界與 Y 軸寬度必須一致，季度才會上下對齊
const MARGIN = { top: 22, right: 12, bottom: 8, left: 0 };
const Y_WIDTH = 46;

const fullQuarter = (d: string) => `${d.slice(0, 4)} Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const shortQuarter = (d: string) => `${d.slice(2, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;

type TipProps = { active?: boolean; payload?: readonly { payload?: EpsChartRow }[] };

function Tip({ active, payload, kind }: TipProps & { kind: "eps" | "margin" }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="label mb-1">
        {fullQuarter(row.date)}
        {row.estimate && "（預估）"}
      </div>
      {kind === "eps" ? (
        <>
          <div className="num font-semibold">
            EPS {row.estimate && "預估 "}
            {row.eps === null ? "—" : fmt(row.eps, 2)} 元
          </div>
          {row.estimate && row.epsLow != null && row.epsHigh != null && (
            <div className="num mt-0.5 text-xs text-muted">
              區間 {fmt(row.epsLow, 2)} ~ {fmt(row.epsHigh, 2)}・{row.analysts ?? "?"} 家
            </div>
          )}
        </>
      ) : (
        <div className="num font-semibold">
          {row.estimate ? "預估季沒有毛利率" : `毛利率 ${row.grossMargin === null ? "—" : fmt(row.grossMargin, 1) + "%"}`}
        </div>
      )}
    </div>
  );
}

// 長條：≤24px 粗，資料端 4px 圓角、基線端方正；負值往下長，圓角在下端。預估季用淺色＋虛線框
type ShapeProps = { x?: number; y?: number; width?: number; height?: number; payload?: EpsChartRow };

function EpsBar({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  if (h === 0 || width === 0) return null;
  const r = Math.min(4, h, width / 2);
  const negative = (payload?.eps ?? 0) < 0;
  const l = x;
  const rt = x + width;
  const b = top + h;
  const d = negative
    ? `M${l},${top} H${rt} V${b - r} Q${rt},${b} ${rt - r},${b} H${l + r} Q${l},${b} ${l},${b - r} Z`
    : `M${l},${b} V${top + r} Q${l},${top} ${l + r},${top} H${rt - r} Q${rt},${top} ${rt},${top + r} V${b} Z`;
  return payload?.estimate ? (
    <path d={d} fill="var(--chart-1)" fillOpacity={0.22} stroke="var(--chart-1)" strokeWidth={1.5} strokeDasharray="4 3" />
  ) : (
    <path d={d} fill="var(--chart-1)" />
  );
}

export default function EpsChart({ rows, code }: { rows: EpsChartRow[]; code: string }) {
  const syncId = `eps-${code}`; // 兩張圖共用十字線與提示框
  const lastActual = rows.map((r) => !r.estimate).lastIndexOf(true);
  const estDates = new Set(rows.filter((r) => r.estimate).map((r) => r.date));
  const hasEstimate = estDates.size > 0;
  const latest = rows[lastActual] ?? rows[rows.length - 1];
  const tick = (d: string) => shortQuarter(d) + (estDates.has(d) ? "E" : "");
  const summary = `近 ${rows.length - estDates.size} 季 EPS 長條圖與毛利率折線圖${
    hasEstimate ? `，另含 ${estDates.size} 季分析師預估 EPS` : ""
  }，最新一季 ${fullQuarter(latest.date)}，EPS ${
    latest.eps === null ? "無資料" : fmt(latest.eps, 2) + " 元"
  }，毛利率 ${latest.grossMargin === null ? "無資料" : fmt(latest.grossMargin, 1) + "%"}。完整數字見下方表格。`;

  return (
    <div className="card p-5 sm:p-6" role="img" aria-label={summary}>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-1)" }} />
          EPS（元）
        </span>
        {hasEstimate && (
          <span className="flex items-center gap-3 text-xs font-normal text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--chart-1)" }} />
              財報實際
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: "color-mix(in srgb, var(--chart-1) 22%, transparent)", border: "1.5px dashed var(--chart-1)" }}
              />
              分析師預估（E）
            </span>
          </span>
        )}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={MARGIN} syncId={syncId} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" hide />
            <YAxis
              width={Y_WIDTH}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              interval={0}
              tickFormatter={(v: number) => fmt(v, v % 1 === 0 ? 0 : 1)}
            />
            <Tooltip
              cursor={{ fill: "var(--line)", opacity: 0.6 }}
              content={(p) => <Tip {...(p as TipProps)} kind="eps" />}
            />
            <Bar
              dataKey="eps"
              maxBarSize={24}
              shape={(p: ShapeProps) => <EpsBar {...p} />}
              isAnimationActive={false}
              label={({ x, y, width, value, index }: LabelProps) =>
                (index === lastActual || rows[index ?? -1]?.estimate) && typeof value === "number" ? (
                  <text
                    x={toNum(x) + toNum(width) / 2}
                    y={value >= 0 ? toNum(y) - 6 : toNum(y) + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--fg)"
                  >
                    {fmt(value, 2)}
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
          <span
            className="-ml-1.5 h-2 w-2 rounded-full"
            style={{ background: "var(--chart-2)", boxShadow: "0 0 0 2px var(--surface)" }}
          />
        </span>
        毛利率（%）
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={MARGIN} syncId={syncId}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              scale="band"
              tickFormatter={tick}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              width={Y_WIDTH}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              domain={[(min: number) => Math.floor(min - 3), (max: number) => Math.ceil(max + 3)]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
              content={(p) => <Tip {...(p as TipProps)} kind="margin" />}
            />
            <Line
              type="monotone"
              dataKey="grossMargin"
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: "var(--chart-2)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--chart-2)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={({ x, y, value, index }: LabelProps) =>
                index === lastActual && typeof value === "number" ? (
                  <text x={toNum(x)} y={toNum(y) - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--fg)">
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
    </div>
  );
}
