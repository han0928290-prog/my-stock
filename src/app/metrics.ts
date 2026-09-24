// 指標頁用的指標定義：每個指標從某一種資料算出每檔股票的「最新值」「變化」與走勢
import type { QuarterRow } from "@/lib/financials";
import type { PerSummary } from "@/lib/per";
import { ytdYoyAt, type RevenueMonth } from "@/lib/revenue-ytd";
import type { Analyst } from "./lib";
import type { Tab } from "./stock-page";

// 批次 API（/api/metrics/[kind]）的資料種類；目標價來自清單頁本來就在抓的 Yahoo 資料＋即時報價
export type FetchKind = "financials" | "revenue" | "per";
export const FETCH_KINDS: FetchKind[] = ["financials", "revenue", "per"];

// 一檔股票的所有指標原始資料：undefined = 還沒載入，null = 查無資料
export type StockData = {
  financials?: QuarterRow[] | null;
  revenue?: RevenueMonth[] | null;
  per?: PerSummary | null;
  price?: number | null;
  analyst?: Analyst | null;
};

export type MetricResult = {
  value: number | null;
  change: number | null;
  period: string | null; // 最新值所屬期間（季末日 YYYY-MM-DD 或月份 YYYY-MM），可直接比大小
  history: { period: string; value: number | null }[]; // 由舊到新，給走勢圖與矩陣；空陣列 = 沒有歷史
};

export type Metric = {
  id: string;
  group: "獲利" | "營收" | "評價";
  label: string;
  unit: string; // 數值單位，顯示在標題與摘要
  digits: number;
  source: FetchKind | "target";
  changeLabel: string; // 變化欄的說明，例如「季增（百分點）」
  changeDigits: number;
  // 變化欄的顏色：trend = 紅漲綠跌；neutral = 不是漲跌（例如一年百分位），用灰色
  changeTone: "trend" | "neutral";
  countLabel: string; // 摘要第三格：符合條件的檔數
  countIf: (r: MetricResult) => boolean | null; // null = 不列入分母
  seriesLabel: string | null; // 走勢欄標題；null = 沒有歷史資料（不顯示走勢欄，也沒有矩陣）
  periodLabel: (period: string) => string;
  historyLabel: (period: string) => string; // 矩陣欄位標題
  // 矩陣配色：sequential = 單色深淺（數值大小）；diverging = 以 0 為中心紅正綠負（會有負值、正負有意義的指標）
  scale: "sequential" | "diverging";
  note: string; // 頁尾的資料說明
  stockTab: Tab; // 從排行點進個股時開哪個分頁
  compute: (d: StockData) => MetricResult;
};

const EMPTY: MetricResult = { value: null, change: null, period: null, history: [] };
const diff = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : a - b);
const shortQuarter = (d: string) => `${d.slice(2, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const shortMonth = (ym: string) => `${ym.slice(2, 4)}/${ym.slice(5, 7)}`;
const isPositive = (r: MetricResult) => (r.change === null ? null : r.change > 0);

// ───────── 獲利（單季財報） ─────────

const at = (rows: QuarterRow[], i: number) => (i >= 0 ? rows[i] : undefined);

// 前一年同一季的索引；FinMind 偶爾缺季，所以用日期找而不是直接 i - 4
const yearAgo = (rows: QuarterRow[], i: number) => {
  const d = rows[i].date;
  const target = `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
  return rows.findIndex((r) => r.date === target);
};

// 近四季 EPS 合計：要剛好是連續四季（第一季和最後一季相差三季）才算
const ttm = (rows: QuarterRow[], i: number) => {
  const first = at(rows, i - 3);
  if (!first) return null;
  const q = (d: string) => Number(d.slice(0, 4)) * 4 + Math.ceil(Number(d.slice(5, 7)) / 3);
  if (q(rows[i].date) - q(first.date) !== 3) return null;
  const four = rows.slice(i - 3, i + 1);
  return four.every((r) => r.eps !== null) ? four.reduce((a, r) => a + (r.eps as number), 0) : null;
};

const FIN_NOTE = "資料來源：FinMind 綜合損益表，為單季數字。";

// 單季財報類指標共用：最新一季的值、變化，以及近 12 季歷史
function quarterly(
  m: Omit<
    Metric,
    | "group"
    | "source"
    | "changeTone"
    | "countIf"
    | "seriesLabel"
    | "periodLabel"
    | "historyLabel"
    | "note"
    | "stockTab"
    | "compute"
  >,
  valueAt: (rows: QuarterRow[], i: number) => number | null,
  changeAt: (rows: QuarterRow[], i: number) => number | null,
): Metric {
  return {
    ...m,
    group: "獲利",
    source: "financials",
    changeTone: "trend",
    countIf: isPositive,
    seriesLabel: "近 8 季",
    periodLabel: shortQuarter,
    historyLabel: shortQuarter,
    note: FIN_NOTE,
    stockTab: "獲利與 EPS",
    compute: ({ financials: rows }) => {
      if (!rows?.length) return EMPTY;
      const last = rows.length - 1;
      return {
        value: valueAt(rows, last),
        change: changeAt(rows, last),
        period: rows[last].date,
        history: rows.map((r, i) => ({ period: r.date, value: valueAt(rows, i) })),
      };
    },
  };
}

const margin = (id: string, label: string, key: "grossMargin" | "operatingMargin") =>
  quarterly(
    {
      id,
      label,
      unit: "%",
      digits: 1,
      changeLabel: "季增（百分點）",
      changeDigits: 1,
      countLabel: "季增為正",
      scale: key === "grossMargin" ? "sequential" : "diverging", // 營業利益率常有虧損的公司
    },
    (rows, i) => rows[i][key],
    (rows, i) => diff(rows[i][key], at(rows, i - 1)?.[key]),
  );

// ───────── 營收（月營收） ─────────

const REV_NOTE = "資料來源：FinMind 月營收。每月 10 日前公布上個月營收。";

function monthly(
  m: Pick<Metric, "id" | "label" | "changeLabel" | "countLabel">, // 營收年增率都可能為負，一律用紅綠配色
  valueAt: (rows: RevenueMonth[], i: number) => number | null,
  changeAt: (rows: RevenueMonth[], i: number) => number | null,
): Metric {
  return {
    ...m,
    group: "營收",
    unit: "%",
    digits: 1,
    source: "revenue",
    changeDigits: 1,
    changeTone: "trend",
    countIf: isPositive,
    seriesLabel: "近 8 個月",
    periodLabel: shortMonth,
    historyLabel: shortMonth,
    scale: "diverging",
    note: REV_NOTE,
    stockTab: "獲利與 EPS", // 月營收圖在這個分頁
    compute: ({ revenue: rows }) => {
      if (!rows?.length) return EMPTY;
      const last = rows.length - 1;
      return {
        value: valueAt(rows, last),
        change: changeAt(rows, last),
        period: rows[last].ym,
        history: rows.map((r, i) => ({ period: r.ym, value: valueAt(rows, i) })),
      };
    },
  };
}

// ───────── 指標清單（順序 = 指標頁的上一個／下一個） ─────────

export const METRICS: Metric[] = [
  quarterly(
    // EPS 有淡旺季，跟去年同季比才有意義
    {
      id: "eps",
      label: "最新一季 EPS",
      unit: "元",
      digits: 2,
      changeLabel: "年增（元）",
      changeDigits: 2,
      countLabel: "年增為正",
      scale: "diverging",
    },
    (rows, i) => rows[i].eps,
    (rows, i) => {
      const j = yearAgo(rows, i);
      return j < 0 ? null : diff(rows[i].eps, rows[j].eps);
    },
  ),
  quarterly(
    {
      id: "ttmEps",
      label: "近四季 EPS 合計",
      unit: "元",
      digits: 2,
      changeLabel: "年增率（%）",
      changeDigits: 1,
      countLabel: "年增為正",
      scale: "diverging",
    },
    ttm,
    (rows, i) => {
      const cur = ttm(rows, i);
      const j = yearAgo(rows, i);
      const prev = j < 0 ? null : ttm(rows, j);
      // 去年同期虧損或為 0 時，成長率沒有意義
      return cur === null || prev === null || prev <= 0 ? null : ((cur - prev) / prev) * 100;
    },
  ),
  margin("grossMargin", "毛利率", "grossMargin"),
  margin("operatingMargin", "營業利益率", "operatingMargin"),

  monthly(
    { id: "revYoy", label: "月營收年增率", changeLabel: "月增率（%）", countLabel: "月增為正" },
    (rows, i) => rows[i].yoy,
    (rows, i) => {
      const prev = rows[i - 1];
      // 上個月要剛好是前一個月份（FinMind 偶爾缺月）
      const expected = new Date(Date.UTC(Number(rows[i].ym.slice(0, 4)), Number(rows[i].ym.slice(5, 7)) - 2, 1))
        .toISOString()
        .slice(0, 7);
      return prev && prev.ym === expected && prev.revenue
        ? ((rows[i].revenue - prev.revenue) / prev.revenue) * 100
        : null;
    },
  ),
  monthly(
    { id: "revYtd", label: "累計營收年增率", changeLabel: "較上月（百分點）", countLabel: "較上月改善" },
    ytdYoyAt,
    // 一月是新年度第一個月，跟去年十二月的累計比沒有意義
    (rows, i) => (rows[i].ym.endsWith("-01") || i === 0 ? null : diff(ytdYoyAt(rows, i), ytdYoyAt(rows, i - 1))),
  ),

  {
    id: "per",
    group: "評價",
    label: "本益比",
    unit: "倍",
    digits: 1,
    source: "per",
    changeLabel: "一年百分位（%）",
    changeDigits: 0,
    changeTone: "neutral",
    countLabel: "低於一年中位",
    countIf: (r) => (r.change === null ? null : r.change < 50),
    seriesLabel: "近 8 個月",
    periodLabel: (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}`,
    historyLabel: shortMonth, // 矩陣是每月月底的本益比
    scale: "sequential",
    note: "資料來源：FinMind 每日本益比（股價 ÷ 近四季 EPS），虧損公司沒有本益比。一年百分位 = 過去一年有幾 % 的交易日比現在便宜，0% 是一年最低。",
    stockTab: "總覽", // 本益比走勢圖在總覽
    compute: ({ per: p }) =>
      p
        ? {
            value: p.per,
            change: p.percentile,
            period: p.date,
            history: p.monthly.map((m) => ({ period: m.ym, value: m.per })),
          }
        : EMPTY,
  },
  {
    id: "upside",
    group: "評價",
    label: "目標價潛在漲幅",
    unit: "%",
    digits: 1,
    source: "target",
    changeLabel: "分析師數",
    changeDigits: 0,
    changeTone: "neutral",
    countLabel: "潛在漲幅為正",
    countIf: (r) => (r.value === null ? null : r.value > 0),
    seriesLabel: null,
    periodLabel: (p) => p,
    historyLabel: (p) => p,
    scale: "diverging",
    note: "資料來源：Yahoo Finance 分析師平均目標價，搭配證交所即時股價，會隨報價更新。",
    stockTab: "目標價",
    compute: ({ price, analyst }) => {
      const target = analyst?.target ?? null;
      if (!price || !target) return EMPTY;
      return { value: ((target - price) / price) * 100, change: analyst?.count ?? null, period: null, history: [] };
    },
  },
];

export type MetricEntry = MetricResult & { code: string; name: string; industry: string };

export function computeEntries(
  metric: Metric,
  stocks: { code: string; name: string; industry: string }[],
  dataOf: (code: string) => StockData,
): MetricEntry[] {
  return stocks.map((s) => ({ code: s.code, name: s.name, industry: s.industry, ...metric.compute(dataOf(s.code)) }));
}
