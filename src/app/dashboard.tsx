"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, HttpError, type AuthUser, type Realtime, type WatchItem } from "./lib";
import StockCard from "./stock-card";
import StockDetail from "./stock-detail";

// mis 約 5 秒內限 3 次請求；所有股票合併成 1 次請求，5 秒輪詢很安全
const POLL_MS = 5000;

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [stocks, setStocks] = useState<WatchItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Realtime>>({});
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  // 登入過期（API 回 401）時回到登入畫面
  const handleError = useCallback(
    (e: Error) => {
      if (e instanceof HttpError && e.status === 401) onLogout();
    },
    [onLogout],
  );

  // 載入儲存在資料庫的追蹤清單
  useEffect(() => {
    getJson<{ stocks: WatchItem[] }>("/api/watchlist")
      .then((r) => setStocks(r.stocks))
      .catch((e: Error) => {
        handleError(e);
        setListError(e.message);
      });
  }, [handleError]);

  const codes = (stocks ?? []).map((s) => s.code).join(",");

  useEffect(() => {
    if (!codes) return;
    const load = () => {
      if (document.hidden) return; // 分頁在背景時不打 API
      getJson<{ quotes: Realtime[] }>(`/api/twse/realtime?codes=${codes}`)
        .then((r) => {
          setQuotes(Object.fromEntries(r.quotes.map((q) => [q.code, q])));
          setUpdatedAt(new Date());
          setError(null);
        })
        .catch((e: Error) => {
          handleError(e);
          setError(e.message);
        });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [codes, handleError]);

  // 選中的股票被移除（或還沒選）時，退回清單第一檔
  const selected =
    stocks?.find((s) => s.code === selectedCode)?.code ?? stocks?.[0]?.code ?? null;

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    const code = input.trim();
    if (!code) return;
    setAdding(true);
    setListError(null);
    try {
      const r = await getJson<{ stocks: WatchItem[] }>("/api/watchlist", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ code }),
      });
      setStocks(r.stocks);
      setSelectedCode(r.stocks[r.stocks.length - 1].code);
      setInput("");
    } catch (err) {
      handleError(err as Error);
      setListError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeStock(code: string) {
    setListError(null);
    try {
      const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}`, {
        method: "DELETE",
      });
      setStocks(r.stocks);
    } catch (err) {
      handleError(err as Error);
      setListError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">my-stock 台股儀表板</h1>
        <div className="flex flex-wrap items-baseline gap-x-4 text-sm text-zinc-500">
          <span>
            {error ? (
              <span className="text-amber-600">更新失敗，顯示上一次資料：{error}</span>
            ) : updatedAt ? (
              `即時報價每 ${POLL_MS / 1000} 秒更新・${updatedAt.toLocaleTimeString("zh-TW")}`
            ) : null}
          </span>
          <span>{user.email}</span>
          <button onClick={onLogout} className="underline hover:text-red-500">
            登出
          </button>
        </div>
      </header>

      <form onSubmit={addStock} className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入股票代號，例如 2603"
          maxLength={8}
          aria-label="股票代號"
          className="w-56 rounded-lg border border-zinc-500/40 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500"
        />
        <button
          type="submit"
          disabled={adding || !input.trim()}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {adding ? "加入中…" : "加入追蹤"}
        </button>
        {listError && <span className="text-sm text-red-500">{listError}</span>}
      </form>

      {!stocks ? (
        !listError && <p className="text-zinc-400">載入追蹤清單中…</p>
      ) : stocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-500/40 p-10 text-center text-zinc-500">
          追蹤清單是空的，在上方輸入股票代號加入第一檔吧。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {stocks.map((s) => (
              <StockCard
                key={s.code}
                code={s.code}
                name={s.name}
                quote={quotes[s.code]}
                selected={selected === s.code}
                onSelect={() => setSelectedCode(s.code)}
                onRemove={() => removeStock(s.code)}
              />
            ))}
          </div>

          {selected && <StockDetail key={selected} code={selected} quote={quotes[selected]} />}
        </>
      )}
    </div>
  );
}
