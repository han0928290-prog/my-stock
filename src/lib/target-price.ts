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

async function fetchOne(code: string): Promise<Analyst | null> {
  const a = await getAuth();
  // 上市 .TW、上櫃 .TWO
  for (const suffix of ["TW", "TWO"]) {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${code}.${suffix}?modules=financialData,summaryDetail&crumb=${encodeURIComponent(a.crumb)}`;
    const res = await fetch(url, { headers: { ...UA, Cookie: a.cookie }, cache: "no-store" });
    if (res.status === 401) auth = null;
    if (!res.ok) continue;
    const body = await res.json().catch(() => null);
    const r = body?.quoteSummary?.result?.[0];
    if (!r) continue;
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
  return null;
}

export async function getAnalystStats(codes: string[]): Promise<Record<string, Analyst | null>> {
  const out: Record<string, Analyst | null> = {};
  await Promise.all(
    codes.map(async (code) => {
      const hit = cache.get(code);
      if (hit && Date.now() - hit.at < TTL) {
        out[code] = hit.value;
        return;
      }
      let value: Analyst | null = null;
      try {
        value = await fetchOne(code);
      } catch {
        // 保持 null；短時間不重試，避免打爆 Yahoo
      }
      cache.set(code, { at: Date.now() - (value === null ? TTL - 10 * 60 * 1000 : 0), value });
      out[code] = value;
    }),
  );
  return out;
}
