import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { getEstimates } from "@/lib/estimates";

// ?code=2330 → { estimates: { periods, history, ratings } | null }（null = 查無分析師預估）
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = (request.nextUrl.searchParams.get("code") ?? "").toUpperCase();
  if (!/^[0-9A-Z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }
  return Response.json({ source: "Yahoo Finance", code, estimates: await getEstimates(code) });
}
