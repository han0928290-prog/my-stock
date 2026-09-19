"use client";

import { VERDICT, type AiState } from "./use-ai-analysis";

const CONFIDENCE = { high: "高", medium: "中", low: "低" } as const;

function Factors({ title, items, tone }: { title: string; items: string[]; tone: "up" | "down" }) {
  const dot = tone === "up" ? "bg-up" : "bg-down";
  const head = tone === "up" ? "text-up" : "text-down";
  return (
    <div>
      <h3 className={`text-sm font-semibold ${head}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">沒有明顯項目</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  state: AiState | undefined;
  hasKey: boolean;
  onRun: () => void;
  onOpenSettings: () => void;
};

// 詳細面板裡的 AI 分析區塊：顯示這檔股票的分析結果（分析本身由卡片或這裡的按鈕觸發）
export default function AiAnalysis({ state, hasKey, onRun, onOpenSettings }: Props) {
  const loading = state?.loading ?? false;
  const result = state?.result ?? null;
  const v = result ? VERDICT[result.analysis.verdict] : null;

  return (
    <section id="ai-panel" className="card scroll-mt-24 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold">AI 利多利空分析</h2>
          <p className="mt-0.5 text-sm text-muted">根據目前的報價、走勢、籌碼與新聞判斷</p>
        </div>
        <button onClick={onRun} disabled={loading} className="btn-primary whitespace-nowrap">
          {loading ? "分析中…" : result ? "重新分析" : hasKey ? "開始分析" : "設定 API Key"}
        </button>
      </div>

      {!hasKey && !result && (
        <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm leading-relaxed text-muted">
          使用前請先在
          <button onClick={onOpenSettings} className="mx-1 text-accent underline underline-offset-4">
            設定
          </button>
          輸入你自己的 OpenAI API Key（只存在這個瀏覽器）。
        </p>
      )}

      {state?.error && (
        <p role="alert" className="mt-4 rounded-lg bg-up-soft px-3 py-2 text-sm text-up">
          {state.error}
        </p>
      )}

      {loading && !result && <div className="mt-5 h-40 animate-pulse rounded-xl bg-line" />}

      {result && v && (
        <div className={`mt-5 space-y-6 transition ${loading ? "opacity-50" : ""}`}>
          <div className={`flex items-start gap-4 rounded-xl p-4 ring-1 ${v.ring}`}>
            <span className={`shrink-0 rounded-lg px-3 py-1.5 text-lg font-bold ${v.cls}`}>{v.label}</span>
            <div className="min-w-0">
              <p className="leading-relaxed">{result.analysis.summary}</p>
              <p className="label mt-2">信心程度：{CONFIDENCE[result.analysis.confidence]}</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Factors title="利多因素" items={result.analysis.bullishFactors} tone="up" />
            <Factors title="利空因素" items={result.analysis.bearishFactors} tone="down" />
          </div>

          <p className="label leading-relaxed">
            模型 {result.model}・資料時間 {result.dataAsOf}・
            {new Date(result.generatedAt).toLocaleTimeString("zh-TW", { hour12: false })} 產生。
            AI 的判斷只依據上述資料，可能有誤，僅供參考，不構成投資建議。
          </p>
        </div>
      )}
    </section>
  );
}
