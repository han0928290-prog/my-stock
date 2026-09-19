"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, maskKey, saveOpenAISettings, useOpenAISettings } from "./openai-settings";

function SettingsForm({ onClose }: { onClose: () => void }) {
  const saved = useOpenAISettings();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(saved?.model ?? DEFAULT_MODEL);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const key = apiKey.trim() || saved?.apiKey || "";
    if (!key) return setError("請輸入 OpenAI API Key");
    if (!/^[\x21-\x7e]{20,300}$/.test(key)) return setError("API Key 格式不正確");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(model.trim())) return setError("模型名稱格式不正確");

    if (!saveOpenAISettings({ apiKey: key, model: model.trim() })) {
      return setError("無法儲存：瀏覽器封鎖了本機儲存空間");
    }
    onClose();
  }

  function clear() {
    saveOpenAISettings(null);
    setApiKey("");
    setModel(DEFAULT_MODEL);
    setError(null);
  }

  return (
    <form onSubmit={save} className="space-y-5 p-6 sm:p-7">
      <div>
        <h2 className="font-serif text-xl font-bold">設定</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          AI 分析使用你自己的 OpenAI API Key，費用由你的 OpenAI 帳戶負擔。
        </p>
      </div>

      <label className="block">
        <span className="label">OPENAI API KEY</span>
        <div className="mt-1.5 flex gap-2">
          <input
            type={show ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={saved ? `已儲存 ${maskKey(saved.apiKey)}（留空表示不變）` : "sk-..."}
            autoComplete="off"
            spellCheck={false}
            className="field"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="shrink-0 rounded-xl border border-line px-3 text-sm text-muted transition hover:text-fg"
          >
            {show ? "隱藏" : "顯示"}
          </button>
        </div>
      </label>

      <label className="block">
        <span className="label">模型</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          spellCheck={false}
          className="field mt-1.5"
        />
        <span className="mt-1.5 block text-xs text-muted">預設 {DEFAULT_MODEL}；可改成你帳號有權限的其他模型名稱。</span>
      </label>

      <div className="rounded-xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
        Key 只會存在這個瀏覽器的 localStorage，不會存到我們的資料庫。每次分析時，Key 會經過本站伺服器轉送給
        OpenAI，伺服器不會儲存或記錄它。請勿在共用電腦上使用，離開前可按「清除金鑰」。
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={!saved}
          className="text-sm text-muted underline-offset-4 transition hover:text-up hover:underline disabled:opacity-40 disabled:no-underline"
        >
          清除金鑰
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-fg"
          >
            取消
          </button>
          <button type="submit" className="btn-primary">
            儲存
          </button>
        </div>
      </div>
    </form>
  );
}

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose} // 按 Esc 時同步狀態
      onClick={(e) => e.target === ref.current && onClose()} // 點背景關閉
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {open && <SettingsForm onClose={onClose} />}
    </dialog>
  );
}
