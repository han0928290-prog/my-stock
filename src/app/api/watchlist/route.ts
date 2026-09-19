import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN, fetchQuotes, MAX_CODES } from "@/lib/mis";
import { getWatchlist, Watchlist } from "@/models/watchlist";

const fail = (e: unknown, status = 500) =>
  Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status });

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await connectDB();
    return Response.json({ stocks: await getWatchlist(session.id) });
  } catch (e) {
    return fail(e);
  }
}

// body: { code: "2330" }，會先向證交所確認代號存在並取得名稱
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
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
      return Response.json({ error: `找不到股票代號 ${code}` }, { status: 404 });
    }

    // 條件式寫入：同時有兩個請求加入同一檔時，只有一個會成功
    const res = await Watchlist.updateOne(
      { _id: session.id, "stocks.code": { $ne: code } },
      { $push: { stocks: { code, name: quote.name } } },
    );
    if (res.modifiedCount === 0) {
      return Response.json({ error: `${code} 已經在追蹤清單中` }, { status: 409 });
    }
    return Response.json({ stocks: await getWatchlist(session.id) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
