import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { mapCodes } from "@/lib/batch";
import { getQuarterlyFinancials } from "@/lib/financials";
import { CODE_PATTERN, MAX_CODES } from "@/lib/mis";
import { getPerSummary } from "@/lib/per";
import { getMonthlyRevenue } from "@/lib/revenue";

// 指標頁一次查所有追蹤個股：/api/metrics/financials|revenue|per?codes=2330,6442
// → { data: { "2330": …, "0050": null } }（null = 查無資料或查詢失敗）
const LOADERS = {
  financials: getQuarterlyFinancials,
  revenue: getMonthlyRevenue,
  per: getPerSummary,
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  if (!(await getTokenSession())) return unauthorized();

  const { kind } = await ctx.params;
  if (!(kind in LOADERS)) return Response.json({ error: "未知的指標資料" }, { status: 404 });

  const codes = (request.nextUrl.searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => CODE_PATTERN.test(c))
    .slice(0, MAX_CODES);
  const load: (code: string) => Promise<unknown> = LOADERS[kind as keyof typeof LOADERS];
  return Response.json({ source: "FinMind", data: await mapCodes(codes, load) });
}
