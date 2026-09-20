import { themeFor } from "@/lib/themes";

// FinMind 台股總覽：代號、名稱、產業別。整份清單很大，只在伺服器端快取一天
const URL_ = "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo";

export type StockInfo = { code: string; name: string; industry: string };

type Row = { stock_id: string; stock_name: string; industry_category: string; type: string };

// 這些不是真正的產業別，不拿來分組
const SKIP = new Set(["", "Index", "大盤", "ETF", "ETN", "受益證券", "存託憑證", "None", "所有證券"]);

let cache: { at: number; list: StockInfo[] } | null = null;
const TTL = 24 * 60 * 60 * 1000;

export async function getStockInfos(): Promise<StockInfo[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.list;
  const headers: HeadersInit = {};
  if (process.env.FINMIND_TOKEN) headers.Authorization = `Bearer ${process.env.FINMIND_TOKEN}`;
  const res = await fetch(URL_, { headers, cache: "no-store" });
  const body = await res.json();
  if (!res.ok || body.status !== 200) throw new Error(body.msg ?? `FinMind responded ${res.status}`);

  // 同一代號可能有多筆（不同日期），以代號去重
  const map = new Map<string, StockInfo>();
  for (const r of body.data as Row[]) {
    if (!/^[0-9A-Za-z]{1,8}$/.test(r.stock_id)) continue;
    const industry = SKIP.has(r.industry_category) ? "其他" : r.industry_category;
    const prev = map.get(r.stock_id);
    // 有真正產業別的優先
    if (!prev || (prev.industry === "其他" && industry !== "其他")) {
      map.set(r.stock_id, { code: r.stock_id, name: r.stock_name, industry });
    }
  }
  cache = { at: Date.now(), list: [...map.values()] };
  return cache.list;
}

export async function industryMap(codes: string[]): Promise<Record<string, string>> {
  try {
    const want = new Set(codes);
    const out: Record<string, string> = {};
    for (const s of await getStockInfos()) if (want.has(s.code)) out[s.code] = s.industry;
    return out;
  } catch {
    return {}; // 查不到就全部歸「其他」，不讓清單壞掉
  }
}

// 用「代號或名稱」找股票：代號完全相符 > 名稱完全相符 > 名稱包含（只有唯一一筆才採用）
export async function resolveStock(query: string): Promise<{ code: string } | { error: string }> {
  const q = query.trim().toUpperCase();
  if (!q) return { error: "請輸入股票代號或名稱" };
  const list = await getStockInfos().catch(() => [] as StockInfo[]);

  const byCode = list.find((s) => s.code.toUpperCase() === q);
  if (byCode) return { code: byCode.code };
  const exact = list.filter((s) => s.name.toUpperCase() === q);
  if (exact.length === 1) return { code: exact[0].code };
  const part = list.filter((s) => s.name.toUpperCase().includes(q));
  if (part.length === 1) return { code: part[0].code };
  if (part.length > 1) {
    return { error: `符合的股票太多：${part.slice(0, 5).map((s) => `${s.name} ${s.code}`).join("、")}…，請輸入更完整的名稱或代號` };
  }
  // 名稱查不到時，若長得像代號就交給證交所確認（清單可能沒收錄新股）
  if (/^[0-9A-Z]{1,8}$/.test(q)) return { code: q };
  return { error: `找不到「${query.trim()}」` };
}

// 給追蹤清單附上分類：自訂題材（PCB、CPO…）優先，否則用 FinMind 產業別
export async function withIndustry<T extends { code: string }>(stocks: T[]) {
  const map = await industryMap(stocks.map((s) => s.code));
  return stocks.map((s) => ({ ...s, industry: themeFor(s.code) ?? map[s.code] ?? "其他" }));
}
