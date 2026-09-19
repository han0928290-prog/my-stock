"use client";

import { useCallback, useState } from "react";
import { getJson } from "./lib";
import { useOpenAISettings } from "./openai-settings";

export type Analysis = {
  verdict: "bullish" | "bearish" | "neutral";
  confidence: "high" | "medium" | "low";
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
};

export type AiResult = {
  model: string;
  dataAsOf: string;
  generatedAt: string;
  analysis: Analysis;
};

// 每檔股票各自一份狀態；重新分析時保留舊結果，避免畫面閃爍
export type AiState = { loading: boolean; result: AiResult | null; error: string | null };

// 台股慣例：利多紅、利空綠
export const VERDICT = {
  bullish: { label: "利多", cls: "bg-up-soft text-up", ring: "ring-up/30" },
  bearish: { label: "利空", cls: "bg-down-soft text-down", ring: "ring-down/30" },
  neutral: { label: "中性", cls: "bg-line text-muted", ring: "ring-line" },
} as const;

export function useAiAnalysis(onNeedKey: () => void) {
  const settings = useOpenAISettings();
  const [states, setStates] = useState<Record<string, AiState>>({});

  const patch = (code: string, p: Partial<AiState>) =>
    setStates((s) => {
      const base: AiState = s[code] ?? { loading: false, result: null, error: null };
      return { ...s, [code]: { ...base, ...p } };
    });

  const run = useCallback(
    async (code: string) => {
      if (!settings) return onNeedKey(); // 還沒設定 Key，引導去設定
      patch(code, { loading: true, error: null });
      try {
        // 打我們自己的後端 API；Key 放在標頭，由伺服器轉送給 OpenAI
        const r = await getJson<AiResult>("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-openai-key": settings.apiKey },
          body: JSON.stringify({ code, model: settings.model }),
        });
        patch(code, { loading: false, result: r });
      } catch (e) {
        patch(code, { loading: false, error: (e as Error).message });
      }
    },
    [settings, onNeedKey],
  );

  return { states, run, hasKey: settings !== null };
}
