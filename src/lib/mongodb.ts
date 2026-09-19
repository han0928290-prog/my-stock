import mongoose from "mongoose";

// 開發模式下 hot reload 會重複載入模組，連線快取在 globalThis 避免一直開新連線
const globalCache = globalThis as unknown as {
  mongooseConn?: Promise<typeof mongoose>;
};

export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("缺少環境變數 MONGODB_URI");

  if (!globalCache.mongooseConn) {
    globalCache.mongooseConn = mongoose.connect(uri).catch((e) => {
      globalCache.mongooseConn = undefined; // 連線失敗時清掉，下次請求才能重試
      throw e;
    });
  }
  return globalCache.mongooseConn;
}
