import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { getWatchlist, Watchlist } from "@/models/watchlist";

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    await connectDB();
    await getWatchlist(session.id); // 確保清單文件存在
    await Watchlist.updateOne({ _id: session.id }, { $pull: { stocks: { code } } });
    return Response.json({ stocks: await getWatchlist(session.id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
