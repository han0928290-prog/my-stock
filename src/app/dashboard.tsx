"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Brand from "./brand";
import { getJson, HttpError, type Analyst, type AuthUser, type Realtime, type WatchItem } from "./lib";
import { THEME_ORDER } from "@/lib/themes";
import {
  DEFAULT_SORT,
  MetricList,
  MetricPage,
  type MetricLayout,
  type MetricSort,
  type MetricSources,
} from "./metric-view";
import { FETCH_KINDS, METRICS, type FetchKind, type StockData } from "./metrics";
import SettingsDialog from "./settings-dialog";
import StockRow from "./stock-row";
import StockPage, { type Tab } from "./stock-page";
import { useAiAnalysis } from "./use-ai-analysis";
import type { CompareSlots } from "./metric-trend";

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
  // 清單模式：「個股」一列一檔股票；「指標」一列一個指標，點進去看所有追蹤個股的這項資料
  const [view, setView] = useState<"stocks" | "metrics">("stocks");
  const [metricId, setMetricId] = useState<string | null>(null);
  const [metricGrouped, setMetricGrouped] = useState(false);
  const [metricLayout, setMetricLayout] = useState<MetricLayout>("rank");
  const [compare, setCompare] = useState<CompareSlots>(null);
  const [metricSorts, setMetricSorts] = useState<Record<string, MetricSort>>({});
  // 指標頁用的財報、營收、本益比：第一次切到「指標」才載入；codes 變了（加入／刪除股票）就重抓
  const [metricData, setMetricData] = useState<MetricData>({});
  const [metricErrors, setMetricErrors] = useState<Partial<Record<FetchKind, string>>>({});
  const requested = useRef<Partial<Record<FetchKind, string>>>({}); // 每種資料已送出請求的 codes，避免重複抓
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

  useEffect(() => {
    if (view !== "metrics" || !codes) return;
    for (const kind of FETCH_KINDS) {
      if (requested.current[kind] === codes) continue;
      requested.current[kind] = codes;
      getJson<{ data: Record<string, never> }>(`/api/metrics/${kind}?codes=${codes}`)
        .then((r) => {
          setMetricData((prev) => ({ ...prev, [kind]: r.data }));
          setMetricErrors((prev) => ({ ...prev, [kind]: undefined }));
        })
        .catch((e: Error) => {
          handleError(e);
          delete requested.current[kind]; // 下次切回「指標」再重試
          setMetricErrors((prev) => ({ ...prev, [kind]: e.message }));
        });
    }
  }, [view, codes, handleError]);

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

  const metric = METRICS.find((m) => m.id === metricId) ?? null;
  // 個股頁、矩陣與走勢圖需要比較寬的版面
  const wide = !!selected || (view === "metrics" && !!metric?.seriesLabel && metricLayout !== "rank");
  const metricSrc: MetricSources = {
    dataOf: (code) => ({
      financials: metricData.financials?.[code],
      revenue: metricData.revenue?.[code],
      per: metricData.per?.[code],
      price: quotes[code]?.price ?? null,
      analyst: analysts[code],
    }),
    // 目標價潛在漲幅用的是清單頁本來就在抓的目標價與即時報價
    loading: (m) =>
      m.source === "target"
        ? Object.keys(analysts).length === 0 || Object.keys(quotes).length === 0
        : !metricData[m.source] && !metricErrors[m.source],
    error: (m) => (m.source === "target" ? null : (metricErrors[m.source] ?? null)),
  };

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

      <main className={`mx-auto w-full space-y-8 px-6 py-8 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
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
        ) : view === "metrics" && metric ? (
          <MetricPage
            metric={metric}
            stocks={stocks ?? []}
            groupOrder={industries}
            src={metricSrc}
            onBack={() => setMetricId(null)}
            sort={metricSorts[metric.id] ?? DEFAULT_SORT}
            onSortChange={(s) => setMetricSorts((prev) => ({ ...prev, [metric.id]: s }))}
            layout={metricLayout}
            onLayoutChange={setMetricLayout}
            compare={compare}
            onCompareChange={setCompare}
            grouped={metricGrouped}
            onGroupedChange={setMetricGrouped}
            onNavigate={(id) => {
              setMetricId(id);
              window.scrollTo({ top: 0 });
            }}
            onOpenStock={(code) => {
              setTab(metric.stockTab); // 直接開這個指標相關的分頁，返回時會回到這個指標
              setSelectedCode(code);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-bold">追蹤清單</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {stocks ? `${stocks.length} 檔` : "載入中…"}
                  {view === "stocks" ? `・報價每 ${POLL_MS / 1000} 秒更新` : "・點指標看所有個股的排行"}
                </p>
              </div>

              <div role="group" aria-label="清單模式" className="flex rounded-lg border border-line p-0.5 text-sm">
                {(
                  [
                    ["stocks", "個股"],
                    ["metrics", "指標"],
                  ] as const
                ).map(([v, text]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`rounded-md px-3 py-1 transition ${view === v ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            {view === "metrics" ? (
              stocks && stocks.length > 0 ? (
                <MetricList stocks={stocks} src={metricSrc} onOpen={setMetricId} />
              ) : (
                <div className="card border-dashed p-12 text-center text-muted">
                  {stocks ? "追蹤清單是空的，先切回「個股」加入股票。" : "載入中…"}
                </div>
              )
            ) : (
              <>
                <div className="mb-6 flex justify-end">
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
              </>
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

// 批次 API 回來的資料，依種類分開放：{ financials: { "2330": [...] }, revenue: {...}, per: {...} }
type MetricData = { [K in FetchKind]?: Record<string, StockData[K]> };

function Group({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`mb-3 text-sm font-bold ${accent ? "text-amber-600" : "text-muted"}`}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
