"use client";

import { useCallback, useEffect, useState } from "react";
import Brand from "./brand";
import { getJson, HttpError, type AuthUser, type Realtime, type WatchItem } from "./lib";
import SettingsDialog from "./settings-dialog";
import StockCard from "./stock-card";
import StockDetail from "./stock-detail";
import { useAiAnalysis } from "./use-ai-analysis";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const ai = useAiAnalysis(openSettings);
  const hasKey = ai.hasKey;

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
    load(); // 第一次一定載入，即使分頁在背景
    // 分頁在背景時暫停輪詢，切回來時立刻更新一次
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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

  // 卡片下方的「AI 分析」：選取該股票、呼叫後端 API，並捲動到結果區
  function analyzeStock(code: string) {
    setSelectedCode(code);
    void ai.run(code);
    if (hasKey) {
      setTimeout(() => document.getElementById("ai-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
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
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Brand />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 text-muted sm:flex" title={error ?? undefined}>
              {error ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  連線異常
                </>
              ) : updatedAt ? (
                <>
                  <span className="live-dot" />
                  <span className="num">{updatedAt.toLocaleTimeString("zh-TW", { hour12: false })}</span>
                </>
              ) : null}
            </span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="max-w-[10rem] truncate text-muted sm:max-w-[16rem]">{user.email}</span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-muted transition hover:border-accent hover:text-fg"
            >
              設定
              <span
                className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-down" : "bg-muted/40"}`}
                title={hasKey ? "已設定 OpenAI API Key" : "尚未設定 OpenAI API Key"}
              />
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg border border-line px-3 py-1.5 text-muted transition hover:border-accent hover:text-fg"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-bold">追蹤清單</h2>
              <p className="mt-0.5 text-sm text-muted">
                {stocks ? `${stocks.length} 檔` : "載入中…"}・報價每 {POLL_MS / 1000} 秒更新
              </p>
            </div>

            <form onSubmit={addStock} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="輸入股票代號，例如 2603"
                maxLength={8}
                aria-label="股票代號"
                className="field w-52"
              />
              <button type="submit" disabled={adding || !input.trim()} className="btn-primary whitespace-nowrap">
                {adding ? "加入中…" : "加入追蹤"}
              </button>
            </form>
          </div>

          {listError && (
            <p role="alert" className="mb-4 rounded-lg bg-up-soft px-3 py-2 text-sm text-up">
              {listError}
            </p>
          )}

          {!stocks ? (
            !listError && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="card h-44 animate-pulse" />
                ))}
              </div>
            )
          ) : stocks.length === 0 ? (
            <div className="card border-dashed p-12 text-center text-muted">
              追蹤清單是空的，在上方輸入股票代號加入第一檔吧。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {stocks.map((s) => (
                <StockCard
                  key={s.code}
                  code={s.code}
                  name={s.name}
                  quote={quotes[s.code]}
                  ai={ai.states[s.code]}
                  selected={selected === s.code}
                  onSelect={() => setSelectedCode(s.code)}
                  onRemove={() => removeStock(s.code)}
                  onAnalyze={() => analyzeStock(s.code)}
                />
              ))}
            </div>
          )}
        </section>

        {selected && (
          <StockDetail
            key={selected}
            code={selected}
            quote={quotes[selected]}
            ai={ai.states[selected]}
            hasKey={hasKey}
            onAnalyze={() => ai.run(selected)}
            onOpenSettings={openSettings}
          />
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-xs leading-relaxed text-muted">
        資料來源：證交所 mis、FinMind、Yahoo奇摩股市。報價可能有延遲，僅供參考，不構成投資建議。
      </footer>
    </>
  );
}
