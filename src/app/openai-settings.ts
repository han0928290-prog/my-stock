import { useMemo, useSyncExternalStore } from "react";

export const DEFAULT_MODEL = "gpt-4o-mini";

// BYOK：使用者自己的 OpenAI API Key 只存在這個瀏覽器的 localStorage
const STORAGE_KEY = "my-stock:openai";

export type OpenAISettings = { apiKey: string; model: string };

const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return ""; // 瀏覽器封鎖儲存空間時視為沒有設定
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // 其他分頁修改時也同步
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

// 回傳是否儲存成功（localStorage 可能被封鎖或已滿）
export function saveOpenAISettings(settings: OpenAISettings | null): boolean {
  try {
    if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export function useOpenAISettings(): OpenAISettings | null {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => {
    try {
      const o = JSON.parse(raw);
      if (typeof o?.apiKey === "string" && o.apiKey) {
        return {
          apiKey: o.apiKey,
          model: typeof o.model === "string" && o.model ? o.model : DEFAULT_MODEL,
        };
      }
    } catch {
      // 內容損毀就當作沒設定
    }
    return null;
  }, [raw]);
}

export const maskKey = (key: string) => (key.length > 10 ? `${key.slice(0, 3)}…${key.slice(-4)}` : "••••");
