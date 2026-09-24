import { finmind } from "./finmind";

// 單季財報（FinMind 綜合損益表，單位：元；毛利率、營益率為 %）
export type QuarterRow = {
  date: string; // 季末日 YYYY-MM-DD
  eps: number | null;
  revenue: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netIncome: number | null;
};

type Row = { date: string; type: string; value: number };

const TYPES = ["EPS", "Revenue", "GrossProfit", "OperatingIncome", "IncomeAfterTaxes"];

// 近 12 季的 EPS、營收、毛利率、營業利益率。個股頁與指標頁共用
export async function getQuarterlyFinancials(code: string): Promise<QuarterRow[]> {
  const rows = await finmind<Row>("TaiwanStockFinancialStatements", code, 1200, 3600);
  const by = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!TYPES.includes(r.type)) continue;
    by.set(r.date, { ...(by.get(r.date) ?? {}), [r.type]: r.value });
  }
  const ratio = (a?: number, b?: number) => (a !== undefined && b ? (a / b) * 100 : null);
  return [...by.entries()]
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
}

