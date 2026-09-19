import mongoose, { type InferSchemaType } from "mongoose";

// 第一次建立清單時的預設股票
export const DEFAULT_STOCKS = [
  { code: "2330", name: "台積電" },
  { code: "2317", name: "鴻海" },
  { code: "2454", name: "聯發科" },
  { code: "2881", name: "富邦金" },
  { code: "2412", name: "中華電" },
];

// 每位使用者一份清單（單一文件），_id 直接用使用者 id，天然保證一人一份
const watchlistSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    stocks: [
      {
        _id: false,
        code: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

export type WatchlistDoc = InferSchemaType<typeof watchlistSchema>;

export const Watchlist: mongoose.Model<WatchlistDoc> =
  mongoose.models.Watchlist ?? mongoose.model("Watchlist", watchlistSchema);

// 取得使用者的清單；第一次使用時用預設五檔建立（之後使用者刪光也不會再被補回）
export async function getWatchlist(userId: string) {
  const doc = await Watchlist.findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: { stocks: DEFAULT_STOCKS } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return doc.stocks.map((s) => ({ code: s.code, name: s.name }));
}
