export type WatchItem = {
  code: string;
  name: string;
  favorite: boolean;
  industry: string;
  note: string;
  noteAt: string | null; // YYYY-MM-DD
  brokers: ManualBroker[];
  timeline: TimelineEntry[];
};

export type TimelineEntry = {
  id: string;
  date: string;
  category: string;
  text: string;
  status: string;
  dueDate: string; // 預計完成日，沒填是空字串
};

export type ManualBroker = { id: string; institution: string; target: number; date: string };

export type Analyst = {
  target: number | null;
  high: number | null;
  low: number | null;
  median: number | null;
  count: number | null;
  pe: number | null;
};

export type AuthUser = { id: string; email: string };

export type Level = { price: number | null; volume: number | null };

export type Realtime = {
  code: string;
  name: string;
  date: string;
  time: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  limitUp: number | null;
  limitDown: number | null;
  totalVolume: number | null;
  asks: Level[];
  bids: Level[];
};

export const fmt = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "-"
    : n.toLocaleString("zh-TW", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

// 台股慣例：紅漲綠跌
export const trendColor = (n: number | null | undefined) =>
  !n ? "text-muted" : n > 0 ? "text-up" : "text-down";

// 漲跌小標籤（底色＋文字色）
export const trendPill = (n: number | null | undefined) =>
  !n ? "bg-line text-muted" : n > 0 ? "bg-up-soft text-up" : "bg-down-soft text-down";

export const trendArrow = (n: number | null | undefined) => (!n ? "" : n > 0 ? "▲" : "▼");

// 給 recharts 用的顏色（SVG 屬性可直接吃 CSS 變數）
export const chartColor = (n: number | null | undefined) =>
  !n ? "var(--muted)" : n > 0 ? "var(--up)" : "var(--down)";

export const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  boxShadow: "var(--shadow)",
  fontSize: 12,
  color: "var(--fg)",
};

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(body.error ?? `請求失敗 (${res.status})`, res.status);
  return body as T;
}
