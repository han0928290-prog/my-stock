import { finmind } from "./finmind";

export type PerPoint = { date: string; per: number | null };

type Row = { date: string; PER: number };

// 近一年的每日本益比（FinMind TaiwanStockPER）。虧損時 PER 為 0，視為沒有資料（null）
export async function getDailyPer(code: string): Promise<PerPoint[]> {
  const rows = await finmind<Row>("TaiwanStockPER", code, 365, 3600);
  return rows.map((r) => ({ date: r.date, per: r.PER > 0 ? r.PER : null }));
}

// 指標頁用的精簡版：只回最新值、一年百分位與每月月底的值，避免一次傳 50 檔 × 250 天
export type PerSummary = {
  date: string;
  per: number | null;
  percentile: number | null; // 過去一年有幾 % 的交易日本益比比現在低；0 = 一年最便宜
  monthly: { ym: string; per: number | null }[]; // 近 12 個月，每月最後一個交易日（本月為最新一天）
};

export async function getPerSummary(code: string): Promise<PerSummary | null> {
  const rows = await getDailyPer(code);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const valid = rows.map((r) => r.per).filter((v): v is number => v !== null);
  const percentile =
    last.per === null || valid.length < 20
      ? null
      : (valid.filter((v) => v < (last.per as number)).length / valid.length) * 100;
  const monthEnd = new Map<string, number | null>();
  for (const r of rows) monthEnd.set(r.date.slice(0, 7), r.per);
  return {
    date: last.date,
    per: last.per,
    percentile,
    monthly: [...monthEnd].slice(-12).map(([ym, per]) => ({ ym, per })),
  };
}
