import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { withIndustry } from "@/lib/stock-info";
import { getWatchlist, Watchlist } from "@/models/watchlist";

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ code: string; id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { code: rawCode, id } = await ctx.params;
  const code = rawCode.toUpperCase();
  if (!CODE_PATTERN.test(code) || !/^[0-9a-f]{24}$/i.test(id)) {
    return Response.json({ error: "參數錯誤" }, { status: 400 });
  }

  try {
    await connectDB();
    await getWatchlist(session.id);
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": code },
      { $pull: { "stocks.$.brokers": { _id: id } } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
