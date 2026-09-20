import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { finmind } from "@/lib/finmind";

type Row = { date: string; type: string; value: number };

// 近幾季的 EPS、營收、毛利率、營業利益率（FinMind 綜合損益表，單位：元）
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const rows = await finmind<Row>("TaiwanStockFinancialStatements", code, 1200, 3600);
    const by = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (!["EPS", "Revenue", "GrossProfit", "OperatingIncome", "IncomeAfterTaxes"].includes(r.type)) continue;
      by.set(r.date, { ...(by.get(r.date) ?? {}), [r.type]: r.value });
    }
    const ratio = (a?: number, b?: number) => (a !== undefined && b ? (a / b) * 100 : null);
    const data = [...by.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, v]) => ({
        date,
        eps: v.EPS ?? null,
        revenue: v.Revenue ?? null,
        grossMargin: ratio(v.GrossProfit, v.Revenue),
        operatingMargin: ratio(v.OperatingIncome, v.Revenue),
        netIncome: v.IncomeAfterTaxes ?? null,
      }));
    return Response.json({ source: "FinMind", code, data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "FinMind request failed" }, { status: 502 });
  }
}
