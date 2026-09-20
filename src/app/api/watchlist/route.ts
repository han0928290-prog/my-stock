import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN, fetchQuotes, MAX_CODES } from "@/lib/mis";
import { resolveStock, withIndustry } from "@/lib/stock-info";
import { getWatchlist, Watchlist } from "@/models/watchlist";

const fail = (e: unknown, status = 500) =>
  Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status });

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await connectDB();
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}

// body: { query: "2330" 或 "台積電" }，會先解析成代號，再向證交所確認存在並取得名稱
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json().catch(() => null);
  const query = String(body?.query ?? body?.code ?? "").trim();
  if (!query || query.length > 20) {
    return Response.json({ error: "請輸入股票代號或名稱" }, { status: 400 });
  }

  try {
    const resolved = await resolveStock(query);
    if ("error" in resolved) return Response.json({ error: resolved.error }, { status: 404 });
    const code = resolved.code.toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
    }

    await connectDB();
    const current = await getWatchlist(session.id);
    if (current.some((s) => s.code === code)) {
      return Response.json({ error: `${code} 已經在追蹤清單中` }, { status: 409 });
    }
    if (current.length >= MAX_CODES) {
      return Response.json({ error: `追蹤清單最多 ${MAX_CODES} 檔` }, { status: 400 });
    }

    const [quote] = await fetchQuotes([code]);
    if (!quote?.name) {
      return Response.json({ error: `找不到股票 ${query}` }, { status: 404 });
    }

    // 條件式寫入：同時有兩個請求加入同一檔時，只有一個會成功
    const res = await Watchlist.updateOne(
      { _id: session.id, "stocks.code": { $ne: code } },
      { $push: { stocks: { code, name: quote.name, favorite: false } } },
    );
    if (res.modifiedCount === 0) {
      return Response.json({ error: `${code} 已經在追蹤清單中` }, { status: 409 });
    }
    return Response.json(
      { stocks: await withIndustry(await getWatchlist(session.id)), added: code },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}
