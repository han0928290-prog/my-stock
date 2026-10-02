"use client";

import { useEffect, useState } from "react";
import AiAnalysis from "./ai-analysis";
import ChipsView from "./chips-view";
import type { Ohlc } from "./indicators";
import KlineChart from "./kline-chart";
import { getJson, type Realtime } from "./lib";
import NewsList from "./news-list";
import RealtimeQuote from "./realtime-quote";
import type { AiState } from "./use-ai-analysis";

const SHOW_DAYS = 180;
// 多抓一段舊資料讓 MA60、MACD 從畫面第一天起就有正確數值
const FETCH_DAYS = SHOW_DAYS + 200;

type Props = {
  code: string;
  quote: Realtime | undefined;
  ai: AiState | undefined;
  hasKey: boolean;
  onAnalyze: () => void;
  onOpenSettings: () => void;
};

export default function StockDetail({ code, quote, ai, hasKey, onAnalyze, onOpenSettings }: Props) {
  const [history, setHistory] = useState<Ohlc[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [fromDate] = useState(() =>
    new Date(Date.now() - SHOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  useEffect(() => {
    getJson<{ data: Ohlc[] }>(`/api/finmind/history?code=${code}&days=${FETCH_DAYS}`)
      .then((r) => setHistory(r.data))
      .catch((e: Error) => setHistoryError(e.message));
  }, [code]);

  return (
    <div className="space-y-6">
      {quote ? (
        <RealtimeQuote quote={quote} />
      ) : (
        <div className="card h-72 animate-pulse" />
      )}

      <AiAnalysis state={ai} hasKey={hasKey} onRun={onAnalyze} onOpenSettings={onOpenSettings} />

      <section className="card p-6 sm:p-8">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-bold">近 {SHOW_DAYS} 天日 K 線</h2>
          <span className="label">日 K・均線・KD・MACD・FinMind</span>
        </div>
        {historyError ? (
          <p className="text-up">歷史線圖載入失敗：{historyError}</p>
        ) : !history ? (
          <div className="h-[44rem] animate-pulse rounded-xl bg-line" />
        ) : (
          <KlineChart rows={history} fromDate={fromDate} />
        )}
      </section>

      <ChipsView code={code} />

      <NewsList code={code} />
    </div>
  );
}
