// Yahoo Finance 分析師目標價與本益比（非官方 API，需要 cookie + crumb）。失敗一律回傳 null
export type Analyst = {
  target: number | null; // 平均目標價
  high: number | null;
  low: number | null;
  median: number | null;
  count: number | null; // 分析師人數
  pe: number | null; // 本益比（近四季）
};

const TTL = 6 * 60 * 60 * 1000;
const UA = { "User-Agent": "Mozilla/5.0" };

let auth: { at: number; cookie: string; crumb: string } | null = null;
const cache = new Map<string, { at: number; value: Analyst | null }>();

async function getAuth() {
  if (auth && Date.now() - auth.at < 60 * 60 * 1000) return auth;
  const r = await fetch("https://fc.yahoo.com", { headers: UA, cache: "no-store", redirect: "manual" });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const c = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...UA, Cookie: cookie },
    cache: "no-store",
  });
  const crumb = (await c.text()).trim();
  if (!c.ok || !crumb || crumb.includes("<")) throw new Error("no crumb");
  auth = { at: Date.now(), cookie, crumb };
  return auth;
}

// 取 Yahoo quoteSummary 的指定模組；先試上市 .TW、再試上櫃 .TWO，都沒有就回 null。
// 目標價、預估 EPS 等都共用這個入口（同一組 cookie + crumb）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchSummary(code: string, modules: string[]): Promise<any | null> {
  const a = await getAuth();
  for (const suffix of ["TW", "TWO"]) {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${code}.${suffix}?modules=${modules.join(",")}&crumb=${encodeURIComponent(a.crumb)}`;
    const res = await fetch(url, { headers: { ...UA, Cookie: a.cookie }, cache: "no-store" });
    if (res.status === 401) auth = null;
    if (!res.ok) continue;
    const body = await res.json().catch(() => null);
    const r = body?.quoteSummary?.result?.[0];
    if (r) return r;
  }
  return null;
}

async function fetchOne(code: string): Promise<Analyst | null> {
  const r = await fetchSummary(code, ["financialData", "summaryDetail"]);
  if (!r) return null;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  const f = r.financialData ?? {};
  return {
    target: n(f.targetMeanPrice?.raw),
    high: n(f.targetHighPrice?.raw),
    low: n(f.targetLowPrice?.raw),
    median: n(f.targetMedianPrice?.raw),
    count: n(f.numberOfAnalystOpinions?.raw),
    pe: n(r.summaryDetail?.trailingPE?.raw),
  };
}

// 同時最多幾個請求打到 Yahoo；追蹤檔數多時避免一次送出上百個請求被擋
const CONCURRENCY = 6;

export async function getAnalystStats(codes: string[]): Promise<Record<string, Analyst | null>> {
  const out: Record<string, Analyst | null> = {};
  const queue = [...codes];
  const worker = async () => {
    for (let code = queue.shift(); code !== undefined; code = queue.shift()) {
      const hit = cache.get(code);
      if (hit && Date.now() - hit.at < TTL) {
        out[code] = hit.value;
        continue;
      }
      let value: Analyst | null = null;
      try {
        value = await fetchOne(code);
      } catch {
        // 保持 null；短時間不重試，避免打爆 Yahoo
      }
      cache.set(code, { at: Date.now() - (value === null ? TTL - 10 * 60 * 1000 : 0), value });
      out[code] = value;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return out;
}
