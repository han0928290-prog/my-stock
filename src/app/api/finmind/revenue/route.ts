import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { finmind } from "@/lib/finmind";

type Row = { date: string; revenue: number; revenue_month: number; revenue_year: number };

// 近 24 個月的月營收與年增率（FinMind TaiwanStockMonthRevenue）。
// 年增率需要去年同月的資料，所以往前多抓 12 個月；累計年增率 = 今年已公布月份合計 vs 去年同期
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const rows = await finmind<Row>("TaiwanStockMonthRevenue", code, 1150, 3600);
    const byMonth = new Map<string, number>();
    for (const r of rows) byMonth.set(`${r.revenue_year}-${String(r.revenue_month).padStart(2, "0")}`, r.revenue);

    const months = [...byMonth.keys()].sort();
    const yoyOf = (ym: string) => {
      const prev = byMonth.get(`${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`);
      const cur = byMonth.get(ym) as number;
      return prev ? ((cur - prev) / prev) * 100 : null;
    };
    const data = months.slice(-24).map((ym) => ({ ym, revenue: byMonth.get(ym) as number, yoy: yoyOf(ym) }));

    // 累計年增率：只比較今年有公布的月份
    let ytdYoy: number | null = null;
    if (months.length) {
      const year = months[months.length - 1].slice(0, 4);
      const thisYear = months.filter((m) => m.startsWith(year));
      const cur = thisYear.reduce((a, m) => a + (byMonth.get(m) as number), 0);
      const prevParts = thisYear.map((m) => byMonth.get(`${Number(year) - 1}${m.slice(4)}`));
      if (prevParts.every((v) => v !== undefined)) {
        const prev = (prevParts as number[]).reduce((a, v) => a + v, 0);
        ytdYoy = prev ? ((cur - prev) / prev) * 100 : null;
      }
    }
    return Response.json({ source: "FinMind", code, data, ytdYoy });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "FinMind request failed" }, { status: 502 });
  }
}
