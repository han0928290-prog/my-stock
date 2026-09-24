import { finmind } from "./finmind";
import type { RevenueMonth } from "./revenue-ytd";

export { ytdYoyAt, type RevenueMonth } from "./revenue-ytd";

type Row = { date: string; revenue: number; revenue_month: number; revenue_year: number };

// 近 24 個月的月營收與年增率（FinMind TaiwanStockMonthRevenue）。
// 年增率需要去年同月的資料，所以往前多抓 12 個月
export async function getMonthlyRevenue(code: string): Promise<RevenueMonth[]> {
  const rows = await finmind<Row>("TaiwanStockMonthRevenue", code, 1150, 3600);
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(`${r.revenue_year}-${String(r.revenue_month).padStart(2, "0")}`, r.revenue);

  const yoyOf = (ym: string) => {
    const prev = byMonth.get(`${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`);
    const cur = byMonth.get(ym) as number;
    return prev ? ((cur - prev) / prev) * 100 : null;
  };
  return [...byMonth.keys()]
    .sort()
    .slice(-24)
    .map((ym) => ({ ym, revenue: byMonth.get(ym) as number, yoy: yoyOf(ym) }));
}
