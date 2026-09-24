import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { getMonthlyRevenue, ytdYoyAt } from "@/lib/revenue";

// 近 24 個月的月營收與年增率（FinMind TaiwanStockMonthRevenue）；累計年增率 = 今年已公布月份合計 vs 去年同期
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const data = await getMonthlyRevenue(code);
    const ytdYoy = data.length ? ytdYoyAt(data, data.length - 1) : null;
    return Response.json({ source: "FinMind", code, data, ytdYoy });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "FinMind request failed" }, { status: 502 });
  }
}
