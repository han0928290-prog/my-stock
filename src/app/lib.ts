export type WatchItem = { code: string; name: string };

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
  !n ? "text-zinc-500" : n > 0 ? "text-red-500" : "text-green-600";

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
