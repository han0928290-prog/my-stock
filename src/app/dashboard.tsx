"use client";

import { useCallback, useEffect, useState } from "react";
import Brand from "./brand";
import { getJson, HttpError, type Analyst, type AuthUser, type Realtime, type WatchItem } from "./lib";
import { THEME_ORDER } from "@/lib/themes";
import SettingsDialog from "./settings-dialog";
import StockRow from "./stock-row";
import StockPage, { type Tab } from "./stock-page";
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
  const [tab, setTab] = useState<Tab>("總覽");
  const [analysts, setAnalysts] = useState<Record<string, Analyst | null>>({});
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

  useEffect(() => {
    if (!codes) return;
    getJson<{ stats: Record<string, Analyst | null> }>(`/api/target?codes=${codes}`)
      .then((r) => setAnalysts((prev) => ({ ...prev, ...r.stats })))
      .catch(() => {});
  }, [codes]);

  // 選中的股票被移除時自動回到清單
  const selected = stocks?.find((s) => s.code === selectedCode)?.code ?? null;

  // 分組：我的最愛在最上面，接著自訂題材（依 themes.ts 順序），再來是產業別，「其他」排最後
  const favorites = (stocks ?? []).filter((s) => s.favorite);
  const groups = new Map<string, WatchItem[]>();
  for (const s of stocks ?? []) groups.set(s.industry, [...(groups.get(s.industry) ?? []), s]);
  const rank = (g: string) => {
    const i = THEME_ORDER.indexOf(g);
    return i >= 0 ? i : g === "其他" ? 1000 : 500;
  };
  const industries = [...groups.keys()].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b, "zh-TW"),
  );

  // 上一檔／下一檔的順序 = 清單上分組後的順序（每檔只算一次，不含「我的最愛」重複列出的那一份）
  const ordered = industries.flatMap((g) => groups.get(g) ?? []);
  const at = ordered.findIndex((s) => s.code === selected);
  const prevStock = at > 0 ? ordered[at - 1] : null;
  const nextStock = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;

  function goTo(code: string) {
    setSelectedCode(code); // 分頁維持不變
    window.scrollTo({ top: 0 });
  }

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;
    setAdding(true);
    setListError(null);
    try {
      const r = await getJson<{ stocks: WatchItem[] }>("/api/watchlist", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ query }),
      });
      setStocks(r.stocks);
      setInput("");
    } catch (err) {
      handleError(err as Error);
      setListError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleFavorite(code: string, favorite: boolean) {
    setListError(null);
    try {
      const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ favorite }),
      });
      setStocks(r.stocks);
    } catch (err) {
      handleError(err as Error);
      setListError((err as Error).message);
    }
  }

  async function saveNote(code: string, note: string) {
    const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ note }),
    }).catch((err: Error) => {
      handleError(err);
      throw err;
    });
    setStocks(r.stocks);
  }

  async function addBroker(code: string, input: { institution: string; target: number; date: string }) {
    const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}/brokers`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    }).catch((err: Error) => {
      handleError(err);
      throw err;
    });
    setStocks(r.stocks);
  }

  async function removeBroker(code: string, id: string) {
    const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}/brokers/${id}`, {
      method: "DELETE",
    }).catch((err: Error) => {
      handleError(err);
      throw err;
    });
    setStocks(r.stocks);
  }

  async function timelineCall(code: string, path: string, init: RequestInit) {
    const r = await getJson<{ stocks: WatchItem[] }>(`/api/watchlist/${code}/timeline${path}`, init).catch(
      (err: Error) => {
        handleError(err);
        throw err;
      },
    );
    setStocks(r.stocks);
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

  const renderRow = (s: WatchItem) => (
    <StockRow
      key={s.code}
      code={s.code}
      name={s.name}
      favorite={s.favorite}
      quote={quotes[s.code]}
      target={analysts[s.code] === undefined ? undefined : (analysts[s.code]?.target ?? null)}
      onOpen={() => {
        setTab("總覽"); // 從清單點進來一律從總覽開始
        setSelectedCode(s.code);
      }}
      onToggleFavorite={() => toggleFavorite(s.code, !s.favorite)}
      onRemove={() => removeStock(s.code)}
    />
  );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-6">
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

      <main className={`mx-auto w-full space-y-8 px-6 py-8 ${selected ? "max-w-5xl" : "max-w-3xl"}`}>
        {selected ? (
          <StockPage
            key={selected}
            item={stocks!.find((x) => x.code === selected)!}
            quote={quotes[selected]}
            analyst={analysts[selected]}
            ai={ai.states[selected]}
            hasKey={hasKey}
            onBack={() => setSelectedCode(null)}
            tab={tab}
            onTabChange={setTab}
            prev={prevStock}
            next={nextStock}
            position={{ index: at + 1, total: ordered.length }}
            onNavigate={goTo}
            onToggleFavorite={() => {
              const it = stocks!.find((x) => x.code === selected)!;
              void toggleFavorite(it.code, !it.favorite);
            }}
            onSaveNote={(note) => saveNote(selected, note)}
            onAddEntry={(e) =>
              timelineCall(selected, "", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(e) })
            }
            onSetEntryStatus={(id, status) =>
              timelineCall(selected, `/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ status }) })
            }
            onSetEntryDue={(id, dueDate) =>
              timelineCall(selected, `/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ dueDate }) })
            }
            onRemoveEntry={(id) => timelineCall(selected, `/${id}`, { method: "DELETE" })}
            onAddBroker={(b) => addBroker(selected, b)}
            onRemoveBroker={(id) => removeBroker(selected, id)}
            onAnalyze={() => ai.run(selected)}
            onOpenSettings={openSettings}
          />
        ) : (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
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
                  placeholder="輸入代號或名稱，例如 2603、長榮"
                  maxLength={20}
                  aria-label="股票代號或名稱"
                  className="field w-64"
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
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="card h-16 animate-pulse" />
                  ))}
                </div>
              )
            ) : stocks.length === 0 ? (
              <div className="card border-dashed p-12 text-center text-muted">
                追蹤清單是空的，在上方輸入股票代號或名稱加入第一檔吧。
              </div>
            ) : (
              <div className="space-y-8">
                <Group title="★ 我的最愛" accent>
                  {favorites.length > 0 ? (
                    favorites.map(renderRow)
                  ) : (
                    <div className="card border-dashed px-4 py-5 text-center text-sm text-muted">
                      還沒有我的最愛，點下面任一檔股票右邊的 ☆ 加進來。
                    </div>
                  )}
                </Group>
                <hr className="border-line" />
                {industries.map((ind) => (
                  <Group key={ind} title={ind}>
                    {groups.get(ind)!.map(renderRow)}
                  </Group>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <footer className="mx-auto w-full max-w-3xl px-6 pb-10 text-xs leading-relaxed text-muted">
        資料來源：證交所 mis、FinMind、Yahoo奇摩股市。報價可能有延遲，僅供參考，不構成投資建議。
      </footer>
    </>
  );
}

function Group({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`mb-3 text-sm font-bold ${accent ? "text-amber-600" : "text-muted"}`}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
