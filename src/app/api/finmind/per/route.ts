import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { getDailyPer } from "@/lib/per";

// 近一年的每日本益比（FinMind TaiwanStockPER）。虧損時 PER 為 0，視為沒有資料（null）
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    return Response.json({ source: "FinMind", code, data: await getDailyPer(code) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "FinMind request failed" }, { status: 502 });
  }
}
