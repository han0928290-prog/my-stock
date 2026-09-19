"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChipsView from "./chips-view";
import { getJson, type Realtime } from "./lib";
import NewsList from "./news-list";
import RealtimeQuote from "./realtime-quote";

type HistoryPoint = { date: string; close: number };

export default function StockDetail({ code, quote }: { code: string; quote: Realtime | undefined }) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ data: HistoryPoint[] }>(`/api/finmind/history?code=${code}&days=180`)
      .then((r) => setHistory(r.data))
      .catch((e: Error) => setHistoryError(e.message));
  }, [code]);

  return (
    <div className="space-y-10 rounded-xl border border-zinc-500/30 p-6">
      {quote ? <RealtimeQuote quote={quote} /> : <p className="text-zinc-400">即時報價載入中…</p>}

      <section>
        <h2 className="mb-3 text-sm text-zinc-500">近 180 天收盤價（FinMind）</h2>
        {historyError ? (
          <p className="text-red-500">歷史線圖載入失敗：{historyError}</p>
        ) : !history ? (
          <p className="text-zinc-400">載入中…</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} minTickGap={40} />
                <YAxis domain={["auto", "auto"]} width={56} />
                <Tooltip />
                <Line type="monotone" dataKey="close" name="收盤價" stroke="#ef4444" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ChipsView code={code} />

      <NewsList code={code} />
    </div>
  );
}
