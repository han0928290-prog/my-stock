// 證交所 mis 即時報價：非正式公開文件的 API，格式可能變動；約 5 秒內最多 3 次請求
const MIS_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

export const MAX_CODES = 20;
export const CODE_PATTERN = /^[0-9A-Za-z]{1,8}$/;

type MisRow = Record<string, string | undefined>;

const num = (s: string | undefined) => {
  const n = parseFloat(s ?? "");
  return Number.isNaN(n) ? null : n;
};

// 五檔字串 "2460.0000_2465.0000_" 轉成數字陣列
const levels = (s: string | undefined) =>
  (s ?? "")
    .split("_")
    .filter(Boolean)
    .map((v) => num(v));

function toQuote(row: MisRow) {
  const asks = levels(row.a);
  const bids = levels(row.b);
  const askVols = levels(row.f);
  const bidVols = levels(row.g);

  // z 是最新成交價；尚未成交時為 "-"，退而用最佳買價
  const price = num(row.z) ?? bids[0] ?? null;
  const prevClose = num(row.y);
  const change = price !== null && prevClose !== null ? price - prevClose : null;

  return {
    code: row.c,
    name: row.n,
    market: row.ex,
    date: row.d,
    time: row.t,
    price,
    prevClose,
    change,
    changePercent: change !== null && prevClose ? (change / prevClose) * 100 : null,
    open: num(row.o),
    high: num(row.h),
    low: num(row.l),
    limitUp: num(row.u),
    limitDown: num(row.w),
    lastVolume: num(row.tv), // 當盤成交量（張）
    totalVolume: num(row.v), // 累積成交量（張）
    asks: asks.map((p, i) => ({ price: p, volume: askVols[i] ?? null })),
    bids: bids.map((p, i) => ({ price: p, volume: bidVols[i] ?? null })),
  };
}

// 一次查多檔（只算 1 次請求），查不到的代號不會出現在結果裡
export async function fetchQuotes(codes: string[]) {
  // 上市 tse、上櫃 otc 一起查，取有資料的那個
  const exCh = codes.flatMap((c) => [`tse_${c}.tw`, `otc_${c}.tw`]).join("|");
  const res = await fetch(`${MIS_URL}?ex_ch=${exCh}&json=1&delay=0`, {
    // 伺服器端短快取，避免多人同時看時打爆證交所
    next: { revalidate: 3 },
  });
  if (!res.ok) throw new Error(`TWSE mis responded ${res.status}`);
  const body: { msgArray?: MisRow[] } = await res.json();
  return (body.msgArray ?? []).filter((r) => r.n).map(toQuote);
}
