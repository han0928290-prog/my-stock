"use client";

import { Fragment } from "react";
import { median } from "./chart-utils";
import TrendView, { type CompareSlots } from "./metric-trend";
import { fmt, trendColor, type WatchItem } from "./lib";
import { computeEntries, METRICS, type Metric, type MetricEntry, type StockData } from "./metrics";

// 指標頁的資料來源，由 dashboard 組好傳進來
export type MetricSources = {
  dataOf: (code: string) => StockData;
  loading: (m: Metric) => boolean;
  error: (m: Metric) => string | null;
};

// 百分比單位直接接在數字後面；元、倍只標在標題上，避免每列都重複
const show = (m: Metric, v: number | null) => (v === null ? "—" : `${fmt(v, m.digits)}${m.unit === "%" ? "%" : ""}`);
const signed = (v: number | null, digits: number) => (v === null ? "—" : `${v > 0 ? "+" : ""}${fmt(v, digits)}`);

type SortKey = "value" | "change";
export type MetricSort = { key: SortKey; desc: boolean };
export const DEFAULT_SORT: MetricSort = { key: "value", desc: true };

// 排行 = 一檔一列看最新值；矩陣 = 一檔一列、一期一欄，看每一檔在每一期的數值；走勢 = 挑幾檔疊在同一張圖
export type MetricLayout = "rank" | "matrix" | "trend";

// 沒有數值的一律排最後
const sorter = (key: SortKey, desc: boolean) => (a: MetricEntry, b: MetricEntry) => {
  const x = a[key];
  const y = b[key];
  if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
  return desc ? y - x : x - y;
};

const GROUPS: Metric["group"][] = ["獲利", "營收", "評價"];

// ───────── 指標清單 ─────────

export function MetricList({
  stocks,
  src,
  onOpen,
}: {
  stocks: WatchItem[];
  src: MetricSources;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <div key={g}>
          <h3 className="mb-3 text-sm font-bold text-muted">{g}</h3>
          <div className="space-y-3">
            {METRICS.filter((m) => m.group === g).map((m) => (
              <MetricCard key={m.id} metric={m} stocks={stocks} src={src} onOpen={() => onOpen(m.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  metric: m,
  stocks,
  src,
  onOpen,
}: {
  metric: Metric;
  stocks: WatchItem[];
  src: MetricSources;
  onOpen: () => void;
}) {
  const error = src.error(m);
  const top =
    error || src.loading(m)
      ? null
      : computeEntries(m, stocks, src.dataOf)
          .filter((e) => e.value !== null)
          .sort(sorter("value", true))
          .slice(0, 3);
  return (
    <button
      onClick={onOpen}
      className="card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:!border-muted/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold">{m.label}</div>
        <div className="mt-0.5 truncate text-sm text-muted">
          {error ? (
            <span className="text-up">載入失敗</span>
          ) : top === null ? (
            <span className="inline-block h-3.5 w-48 animate-pulse rounded bg-line align-middle" />
          ) : top.length === 0 ? (
            "沒有資料"
          ) : (
            top.map((e, i) => (
              <span key={e.code}>
                {i > 0 && "・"}
                {e.name} <span className="num text-fg">{show(m, e.value)}</span>
              </span>
            ))
          )}
        </div>
      </div>
      <span className="text-lg text-muted">›</span>
    </button>
  );
}

// ───────── 單一指標的排行頁 ─────────

type PageProps = {
  metric: Metric;
  stocks: WatchItem[];
  groupOrder: string[]; // 題材分組的順序，與追蹤清單一致
  src: MetricSources;
  onBack: () => void;
  onNavigate: (id: string) => void;
  onOpenStock: (code: string) => void;
  // 排序（每個指標各自記住）與分組設定由外層保管，點進個股再返回時才不會被重設
  sort: MetricSort;
  onSortChange: (sort: MetricSort) => void;
  grouped: boolean;
  onGroupedChange: (grouped: boolean) => void;
  layout: MetricLayout;
  onLayoutChange: (layout: MetricLayout) => void;
  compare: CompareSlots; // 走勢疊圖比較中的股票，切換指標時保留
  onCompareChange: (slots: CompareSlots) => void;
};

export function MetricPage({
  metric,
  stocks,
  groupOrder,
  src,
  onBack,
  onNavigate,
  onOpenStock,
  grouped,
  onGroupedChange,
  sort,
  onSortChange,
  layout: wantLayout,
  onLayoutChange,
  compare,
  onCompareChange,
}: PageProps) {
  // 沒有歷史資料的指標（目標價潛在漲幅）只有排行
  const layout = metric.seriesLabel ? wantLayout : "rank";
  const idx = METRICS.findIndex((m) => m.id === metric.id);
  const prev = METRICS[idx - 1] ?? null;
  const next = METRICS[idx + 1] ?? null;
  const error = src.error(metric);
  const loading = src.loading(metric);

  const entries = loading || error ? [] : computeEntries(metric, stocks, src.dataOf);
  const withValue = entries.filter((e) => e.value !== null).sort(sorter(sort.key, sort.desc));
  const missing = entries.filter((e) => e.value === null);
  const values = withValue.map((e) => e.value as number);
  const maxAbs = Math.max(...values.map(Math.abs), 1e-9);
  // 多數公司已公布到的最新期；比它舊的列會標出期別
  const latest = withValue.reduce((a, e) => (e.period && e.period > a ? e.period : a), "");
  const best = [...withValue].sort(sorter("value", true))[0];
  const counted = withValue.map((e) => metric.countIf(e)).filter((c) => c !== null);
  const hits = counted.filter(Boolean).length;
  const changeShort = metric.changeLabel.replace(/（.*/, "");

  const sections: { title: string | null; items: MetricEntry[] }[] = grouped
    ? groupOrder
        .map((g) => ({ title: g, items: withValue.filter((e) => e.industry === g) }))
        .filter((s) => s.items.length > 0)
    : [{ title: null, items: withValue }];

  // 點目前的排序鈕 = 反轉方向（例如本益比想從低看到高）
  const pickSort = (key: SortKey) => onSortChange(sort.key === key ? { key, desc: !sort.desc } : { key, desc: true });
  const arrow = (key: SortKey) => (sort.key === key ? (sort.desc ? " ↓" : " ↑") : "");

  const cols = metric.seriesLabel
    ? "grid-cols-[1.5rem_minmax(0,7rem)_1fr_4.5rem] sm:grid-cols-[1.5rem_minmax(0,8rem)_1fr_5.5rem_4.5rem]"
    : "grid-cols-[1.5rem_minmax(0,7rem)_1fr_4.5rem] sm:grid-cols-[1.5rem_minmax(0,8rem)_1fr_5.5rem]";

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
        ← 返回指標清單
      </button>

      <nav aria-label="切換指標" className="flex items-center justify-between gap-3 text-sm">
        <MetricNav dir="prev" metric={prev} onGo={onNavigate} />
        <span className="num shrink-0 text-xs text-muted">
          {idx + 1} / {METRICS.length}
        </span>
        <MetricNav dir="next" metric={next} onGo={onNavigate} />
      </nav>

      <div>
        <div className="text-sm text-muted">{metric.group}・所有追蹤個股</div>
        <h2 className="mt-0.5 font-serif text-3xl font-bold">
          {metric.label}
          <span className="ml-2 text-base font-normal text-muted">（{metric.unit}）</span>
        </h2>
      </div>

      {error ? (
        <p className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">資料載入失敗：{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          <div className="card h-20 animate-pulse" />
          <div className="card h-96 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="中位數" value={values.length ? show(metric, median(values)) : "—"} />
            <Stat label="最高" value={best ? show(metric, best.value) : "—"} sub={best?.name} />
            <Stat label={metric.countLabel} value={counted.length ? `${hits} / ${counted.length}` : "—"} sub="檔" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {metric.seriesLabel && (
                <Segmented
                  label="檢視方式"
                  options={[
                    ["rank", "排行"],
                    ["matrix", "矩陣"],
                    ["trend", "走勢"],
                  ]}
                  value={layout}
                  onChange={(v) => onLayoutChange(v as MetricLayout)}
                />
              )}
              <Segmented
                label="排序（再點一次反轉）"
                options={[
                  ["value", `依數值${arrow("value")}`],
                  ["change", `依${changeShort}${arrow("change")}`],
                ]}
                value={sort.key}
                onChange={(v) => pickSort(v as SortKey)}
              />
            </div>
            <Segmented
              label="分組"
              options={[
                ["none", "不分組"],
                ["group", "依題材"],
              ]}
              value={grouped ? "group" : "none"}
              onChange={(v) => onGroupedChange(v === "group")}
            />
          </div>

          {layout === "trend" ? (
            <TrendView metric={metric} entries={withValue} slots={compare} onSlotsChange={onCompareChange} />
          ) : layout === "matrix" ? (
            <Matrix metric={metric} sections={sections} onOpen={onOpenStock} />
          ) : (
            <div className="card overflow-hidden">
              <div className={`grid ${cols} items-center gap-3 border-b border-line px-4 py-2.5 text-xs text-muted`}>
                <span>#</span>
                <span>股票</span>
                <span>{metric.label}</span>
                <span className="text-right">{metric.changeLabel}</span>
                {metric.seriesLabel && <span className="hidden text-right sm:block">{metric.seriesLabel}</span>}
              </div>
              {sections.map((s) => (
                <div key={s.title ?? "all"}>
                  {s.title && (
                    <div className="border-b border-line bg-surface-2 px-4 py-1.5 text-xs font-bold text-muted">
                      {s.title}
                    </div>
                  )}
                  {s.items.map((e, i) => (
                    <Row
                      key={e.code}
                      cols={cols}
                      rank={i + 1}
                      entry={e}
                      metric={metric}
                      maxAbs={maxAbs}
                      stale={!!e.period && e.period < latest}
                      onOpen={() => onOpenStock(e.code)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-xs leading-relaxed text-muted">沒有資料：{missing.map((e) => e.name).join("、")}</p>
          )}
          <p className="text-xs leading-relaxed text-muted">
            {metric.note}
            {layout === "rank" && latest && ` 標示期別的列表示該公司最新資料早於 ${metric.periodLabel(latest)}。`}
            {layout !== "trend" && "點任一列可看個股細節。"}
          </p>
        </>
      )}
    </div>
  );
}

function Row({
  cols,
  rank,
  entry: e,
  metric,
  maxAbs,
  stale,
  onOpen,
}: {
  cols: string;
  rank: number;
  entry: MetricEntry;
  metric: Metric;
  maxAbs: number;
  stale: boolean;
  onOpen: () => void;
}) {
  const v = e.value as number;
  return (
    <button
      onClick={onOpen}
      className={`grid w-full ${cols} items-center gap-3 border-b border-line px-4 py-2.5 text-left text-sm transition last:border-0 hover:bg-surface-2`}
    >
      <span className="num text-xs text-muted">{rank}</span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{e.name}</span>
        <span className="num text-xs text-muted">{e.code}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 min-w-0 flex-1">
          <span
            className="block h-2 rounded-full"
            style={{
              width: `${(Math.abs(v) / maxAbs) * 100}%`,
              background: v >= 0 ? "var(--chart-1)" : "var(--down)",
              opacity: stale ? 0.45 : 1,
            }}
          />
        </span>
        <span className={`num w-16 shrink-0 text-right font-semibold ${v < 0 ? "text-down" : ""}`}>
          {show(metric, v)}
        </span>
        {stale && e.period && (
          <span className="num shrink-0 rounded bg-line px-1 text-[10px] text-muted" title="尚未公布最新一期">
            {metric.periodLabel(e.period)}
          </span>
        )}
      </span>
      <span className={`num text-right ${metric.changeTone === "trend" ? trendColor(e.change) : "text-muted"}`}>
        {metric.changeTone === "trend"
          ? signed(e.change, metric.changeDigits)
          : e.change === null
            ? "—"
            : fmt(e.change, metric.changeDigits)}
      </span>
      {metric.seriesLabel && (
        <span className="hidden justify-end sm:flex">
          <Sparkline values={e.history.slice(-8).map((h) => h.value)} />
        </span>
      )}
    </button>
  );
}

// ───────── 矩陣（熱力表） ─────────

const MATRIX_COLS = 12;

// 取排序後第 p 分位的值（p = 0~1）
const quantile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

// 底色 = 指定顏色與底色混合，t = 0~1 越大越深
const mix = (color: string, t: number, base: string) =>
  `color-mix(in oklab, ${color} ${Math.round(8 + t * 80)}%, ${base})`;

// 依指標配色把數值轉成格子底色。上下界用百分位而不是最大／最小值，
// 避免一兩檔極端值（例如年增 500%）把其他格子都洗成淡色；超出的格子就是最深色，數字照樣看得到
function colorScale(metric: Metric, values: number[]) {
  if (metric.scale === "diverging") {
    // 正負兩邊各自取第 80 百分位當最深色：營收年增率常見 +300% 但很少低於 -60%，共用一個上限會讓負值幾乎看不到顏色
    const arm = (xs: number[]) =>
      (xs.length
        ? quantile(
            xs.sort((a, b) => a - b),
            0.8,
          )
        : 0) || 1;
    const pos = arm(values.filter((v) => v > 0));
    const neg = arm(values.filter((v) => v < 0).map((v) => -v));
    const hasNeg = values.some((v) => v < 0);
    return {
      lo: hasNeg ? -neg : 0,
      hi: pos,
      gradient: `linear-gradient(to right, ${hasNeg ? `${mix("var(--down)", 1, "var(--surface-2)")}, ` : ""}var(--surface-2), ${mix("var(--up)", 1, "var(--surface-2)")})`,
      // 台股慣例：正值紅、負值綠，0 附近是中性色
      cell: (v: number) => {
        const t = Math.min(Math.abs(v) / (v >= 0 ? pos : neg), 1);
        return { background: mix(v >= 0 ? "var(--up)" : "var(--down)", t, "var(--surface-2)"), strong: t > 0.65 };
      },
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const lo = quantile(sorted, 0.05);
  const hi = quantile(sorted, 0.95);
  const span = hi - lo || 1;
  return {
    lo,
    hi,
    gradient: `linear-gradient(to right, ${mix("var(--chart-1)", 0, "var(--surface)")}, ${mix("var(--chart-1)", 1, "var(--surface)")})`,
    cell: (v: number) => {
      const t = Math.min(Math.max((v - lo) / span, 0), 1);
      return { background: mix("var(--chart-1)", t, "var(--surface)"), strong: t > 0.65 };
    },
  };
}

function Matrix({
  metric,
  sections,
  onOpen,
}: {
  metric: Metric;
  sections: { title: string | null; items: MetricEntry[] }[];
  onOpen: (code: string) => void;
}) {
  const all = sections.flatMap((s) => s.items);
  // 欄位 = 所有股票出現過的期別（依日曆對齊），取最近 12 期；還沒公布的格子留白
  const periods = [...new Set(all.flatMap((e) => e.history.map((h) => h.period)))].sort().slice(-MATRIX_COLS);
  const byCode = new Map(all.map((e) => [e.code, new Map(e.history.map((h) => [h.period, h.value]))]));
  const cells = [...byCode.values()].flatMap((m) => periods.map((p) => m.get(p)).filter((v): v is number => v != null));
  if (cells.length === 0) return <div className="card p-8 text-center text-muted">沒有歷史資料。</div>;
  const scale = colorScale(metric, cells);
  const unit = metric.unit === "%" ? "%" : "";
  const show = (v: number) => `${fmt(v, metric.digits)}${unit}`;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-end gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
        <span className="num">≤ {show(scale.lo)}</span>
        <span className="h-2 w-32 rounded-full" style={{ background: scale.gradient }} aria-hidden />
        <span className="num">≥ {show(scale.hi)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr className="text-muted">
              <th className="sticky left-0 z-10 bg-surface px-2 py-2 text-left font-medium">股票</th>
              {periods.map((p) => (
                <th key={p} className="num min-w-12 px-1 py-2 text-center font-medium">
                  {metric.historyLabel(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <Fragment key={s.title ?? "all"}>
                {s.title && (
                  <tr>
                    <td colSpan={periods.length + 1} className="px-2 pb-1 pt-3 text-left font-bold text-muted">
                      {s.title}
                    </td>
                  </tr>
                )}
                {s.items.map((e) => {
                  const byPeriod = byCode.get(e.code)!;
                  return (
                    <tr key={e.code} onClick={() => onOpen(e.code)} className="group cursor-pointer">
                      <td className="sticky left-0 z-10 bg-surface px-2 py-1 transition group-hover:bg-surface-2">
                        {/* 整列可點；名稱另外用按鈕，鍵盤也能操作 */}
                        <button
                          className="block max-w-28 text-left"
                          onClick={(ev) => (ev.stopPropagation(), onOpen(e.code))}
                        >
                          <span className="block truncate text-sm font-bold">{e.name}</span>
                          <span className="num text-muted">{e.code}</span>
                        </button>
                      </td>
                      {periods.map((p) => {
                        const v = byPeriod.get(p);
                        if (v == null)
                          return (
                            <td
                              key={p}
                              className="rounded bg-line/40"
                              title={`${e.name} ${metric.historyLabel(p)}：沒有資料`}
                            />
                          );
                        const c = scale.cell(v);
                        return (
                          <td
                            key={p}
                            title={`${e.name} ${metric.historyLabel(p)}：${show(v)}`}
                            className={`num rounded px-1 py-2 text-center transition group-hover:brightness-95 ${c.strong ? "text-[var(--heat-ink)]" : "text-fg"}`}
                            style={{ background: c.background }}
                          >
                            {fmt(v, metric.digits)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 小走勢圖，最後一點加圓點；缺值的期直接跳過
function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 64;
  const H = 20;
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <span className="text-xs text-muted">—</span>;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const span = Math.max(...ys) - lo || 1;
  const x = (i: number) => 2 + (i / Math.max(values.length - 1, 1)) * (W - 4);
  const y = (v: number) => H - 2 - ((v - lo) / span) * (H - 4);
  const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const [li, lv] = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(li)} cy={y(lv)} r={2} fill="var(--chart-1)" />
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-xl font-bold">{value}</span>
        {sub && <span className="truncate text-xs text-muted">{sub}</span>}
      </div>
    </div>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5 text-sm">
      {options.map(([v, text]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-md px-3 py-1 transition ${value === v ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function MetricNav({ dir, metric, onGo }: { dir: "prev" | "next"; metric: Metric | null; onGo: (id: string) => void }) {
  if (!metric) return <span className="flex-1" />;
  return (
    <button
      onClick={() => onGo(metric.id)}
      className={`flex flex-1 items-center gap-1.5 text-muted transition hover:text-fg ${dir === "next" ? "justify-end" : ""}`}
    >
      {dir === "prev" ? `‹ ${metric.label}` : `${metric.label} ›`}
    </button>
  );
}
