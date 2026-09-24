import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { getQuarterlyFinancials } from "@/lib/financials";

// 近幾季的 EPS、營收、毛利率、營業利益率（FinMind 綜合損益表，單位：元）
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    return Response.json({ source: "FinMind", code, data: await getQuarterlyFinancials(code) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "FinMind request failed" }, { status: 502 });
  }
}
