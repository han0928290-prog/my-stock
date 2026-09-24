"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
  useYAxisScale,
} from "recharts";
import { axisTick, niceTicks } from "./chart-utils";
import { fmt, tooltipStyle } from "./lib";
import type { Metric, MetricEntry } from "./metrics";

// 最多同時比較幾檔。20 多條線疊在一起會變成一團，看不出誰是誰
export const MAX_COMPARE = 5;

// 分類色：dataviz 參考色盤前 5 格，順序即色盲安全的排列（已用 validate_palette.js 驗證亮／暗色）
const SERIES = Array.from({ length: MAX_COMPARE }, (_, i) => `var(--series-${i + 1})`);

const PERIODS = 12;

// 比較名單用固定 5 個位置：每檔股票佔一格、顏色跟著格子走，加減其他股票時已選的顏色不會變。
// null = 使用者還沒挑過，預設顯示目前排序的前 3 名
export type CompareSlots = (string | null)[] | null;

type Series = { slot: number; entry: MetricEntry };

export default function TrendView({
  metric,
  entries,
  slots,
  onSlotsChange,
}: {
  metric: Metric;
  entries: MetricEntry[]; // 依目前排序
  slots: CompareSlots;
  onSlotsChange: (slots: CompareSlots) => void;
}) {
  const candidates = entries.filter((e) => e.history.some((h) => h.value !== null));
  const auto = slots === null;
  const effective = auto
    ? Array.from({ length: MAX_COMPARE }, (_, i) => (i < 3 ? (candidates[i]?.code ?? null) : null))
    : slots;
  const byCode = new Map(candidates.map((e) => [e.code, e]));
  const series: Series[] = effective.flatMap((code, slot) => {
    const entry = code ? byCode.get(code) : undefined;
    return entry ? [{ slot, entry }] : [];
  });
  const full = series.length >= MAX_COMPARE;

  function toggle(code: string) {
    const next = [...effective];
    const at = next.indexOf(code);
    if (at >= 0) next[at] = null;
    else {
      const free = next.indexOf(null);
      if (free < 0) return;
      next[free] = code;
    }
    onSlotsChange(next);
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
        <span>
          比較 {series.length} / {MAX_COMPARE} 檔{auto && "・預設為目前排序的前 3 名"}
        </span>
        {series.length > 0 && (
          <button onClick={() => onSlotsChange(Array(MAX_COMPARE).fill(null))} className="hover:text-fg">
            清除
          </button>
        )}
      </div>

      {series.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
          從下方選 2～{MAX_COMPARE} 檔股票比較走勢
        </div>
      ) : (
        <Chart metric={metric} series={series} />
      )}

      <div>
        <div className="mb-2 text-xs text-muted">點選股票加入或移出比較（最多 {MAX_COMPARE} 檔）</div>
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((e) => {
            const slot = effective.indexOf(e.code);
            const on = slot >= 0;
            return (
              <button
                key={e.code}
                onClick={() => toggle(e.code)}
                disabled={!on && full}
                aria-pressed={on}
                title={!on && full ? `最多比較 ${MAX_COMPARE} 檔，先移除一檔` : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  on
                    ? "border-muted/50 bg-surface-2 font-medium text-fg"
                    : "border-line text-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                }`}
              >
                {/* 線條圖的圖例用短線，不用色塊 */}
                {on && <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[slot] }} aria-hidden />}
                {e.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Chart({ metric, series }: { metric: Metric; series: Series[] }) {
  const valueMaps = series.map((s) => new Map(s.entry.history.map((h) => [h.period, h.value])));
  // 欄位依日曆對齊，取選中股票最近 12 期
  const periods = [...new Set(series.flatMap((s) => s.entry.history.map((h) => h.period)))].sort().slice(-PERIODS);
  const data: Record<string, string | number | null>[] = periods.map((p) => ({
    period: p,
    ...Object.fromEntries(series.map((s, i) => [s.entry.code, valueMaps[i].get(p) ?? null])),
  }));
  const nums = valueMaps.flatMap((m) => periods.map((p) => m.get(p)).filter((v): v is number => v != null));
  if (nums.length === 0)
    return <div className="flex h-80 items-center justify-center text-sm text-muted">沒有資料</div>;
  const ticks = niceTicks(Math.min(...nums), Math.max(...nums));
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const unit = metric.unit === "%" ? "%" : "";

  // 線尾標籤：每條線最後一個有值的點
  const ends = series.flatMap((s, i) => {
    const last = [...periods].reverse().find((p) => valueMaps[i].get(p) != null);
    return last
      ? [{ code: s.entry.code, name: s.entry.name, color: SERIES[s.slot], value: valueMaps[i].get(last) as number }]
      : [];
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 124, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="period"
            tickFormatter={metric.historyLabel}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => `${fmt(v, Number.isInteger(step) ? 0 : 1)}${unit}`}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            content={({ active, label }) => (
              <Tip active={active} period={label as string | undefined} metric={metric} series={series} data={data} />
            )}
          />
          {series.map((s) => (
            <Line
              key={s.entry.code}
              dataKey={s.entry.code}
              name={s.entry.name}
              stroke={SERIES[s.slot]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
          <EndLabels items={ends} unit={unit} digits={metric.digits} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 十字線對到的那一期：列出所有比較中的股票，數值由高到低
function Tip({
  active,
  period,
  metric,
  series,
  data,
}: {
  active?: boolean;
  period?: string;
  metric: Metric;
  series: Series[];
  data: Record<string, string | number | null>[];
}) {
  const row = data.find((r) => r.period === period);
  if (!active || !row || !period) return null;
  const rows = series
    .map((s) => ({ s, v: row[s.entry.code] as number | null }))
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="label mb-1.5">{metric.historyLabel(period)}</div>
      <div className="space-y-1">
        {rows.map(({ s, v }) => (
          <div key={s.entry.code} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: SERIES[s.slot] }} />
            <span className="num w-16 font-semibold">
              {v === null ? "—" : `${fmt(v, metric.digits)}${metric.unit === "%" ? "%" : ""}`}
            </span>
            <span className="text-xs text-muted">{s.entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 線尾直接標名稱，不用來回對圖例；標籤太近時往下錯開，避免重疊
const LABEL_GAP = 14;

function EndLabels({
  items,
  unit,
  digits,
}: {
  items: { code: string; name: string; color: string; value: number }[];
  unit: string;
  digits: number;
}) {
  const yScale = useYAxisScale();
  const area = usePlotArea();
  if (!yScale || !area) return null;
  const placed = items
    .map((it) => ({ ...it, y: Number(yScale(it.value)) }))
    .filter((it) => Number.isFinite(it.y))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i++) placed[i].y = Math.max(placed[i].y, placed[i - 1].y + LABEL_GAP);
  // 錯開後超出下緣的話整組往上推
  const overflow = placed.length ? placed[placed.length - 1].y - (area.y + area.height) : 0;
  if (overflow > 0) for (const p of placed) p.y -= overflow;
  const x = area.x + area.width;
  return (
    <g>
      {placed.map((p) => (
        <g key={p.code}>
          <line x1={x + 4} x2={x + 12} y1={p.y} y2={p.y} stroke={p.color} strokeWidth={2} strokeLinecap="round" />
          <text x={x + 16} y={p.y} dy="0.32em" fontSize={11} fill="var(--fg)">
            {p.name}
            <tspan fill="var(--muted)" dx={4}>
              {fmt(p.value, digits)}
              {unit}
            </tspan>
          </text>
        </g>
      ))}
    </g>
  );
}
