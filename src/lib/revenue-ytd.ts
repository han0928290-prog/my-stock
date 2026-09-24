// 前後端共用的月營收型別與計算（不引用 FinMind，才能放進瀏覽器端的程式）
export type RevenueMonth = { ym: string; revenue: number; yoy: number | null }; // ym = YYYY-MM

// 累計年增率：到 months[i] 為止今年已公布月份的合計 vs 去年同期；缺任何一個月就回 null
export function ytdYoyAt(months: RevenueMonth[], i: number): number | null {
  const byMonth = new Map(months.map((m) => [m.ym, m.revenue]));
  const year = months[i].ym.slice(0, 4);
  const thisYear = months.slice(0, i + 1).filter((m) => m.ym.startsWith(year));
  const cur = thisYear.reduce((a, m) => a + m.revenue, 0);
  const prevParts = thisYear.map((m) => byMonth.get(`${Number(year) - 1}${m.ym.slice(4)}`));
  if (prevParts.some((v) => v === undefined)) return null;
  const prev = (prevParts as number[]).reduce((a, v) => a + v, 0);
  return prev ? ((cur - prev) / prev) * 100 : null;
}
