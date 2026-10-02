"use client";

import { useRef, useState } from "react";
import { CATEGORIES, DUE_CATEGORIES, STATUSES } from "@/lib/timeline";
import { getJson } from "./lib";
import { useOpenAISettings } from "./openai-settings";

type Entry = { date: string; category: string; status: string; dueDate: string; text: string };
type Draft = Entry & { code: string };
type Row = Draft & { id: number; keep: boolean };

type Props = {
  stocks: { code: string; name: string }[];
  onAdd: (code: string, e: Entry) => Promise<void>;
  onOpenSettings: () => void;
};

const MAX_FILES = 6;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.txt,.md,.csv,.json,text/plain";

const sizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

// 上傳圖片／PDF／文字，請 AI 依指令擷取資訊、判斷屬於追蹤清單中的哪一檔，確認後寫入各檔的筆記
export default function AiNoteImport({ stocks, onAdd, onOpenSettings }: Props) {
  const settings = useOpenAISettings();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    setFiles((cur) => {
      const merged = [...cur, ...incoming];
      if (merged.length > MAX_FILES) setError(`一次最多 ${MAX_FILES} 個檔案，多的已略過`);
      return merged.slice(0, MAX_FILES);
    });
  }

  async function extract() {
    if (!settings) return onOpenSettings();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("model", settings.model);
      form.set("instruction", instruction.trim());
      form.set("text", text.trim());
      files.forEach((f) => form.append("files", f, f.name || "image.png"));
      // 打我們自己的後端 API；Key 放在標頭，由伺服器轉送給 OpenAI
      const r = await getJson<{ entries: Draft[]; skipped: number }>("/api/ai/extract-notes", {
        method: "POST",
        headers: { "x-openai-key": settings.apiKey },
        body: form,
      });
      setRows(r.entries.map((d, i) => ({ ...d, id: i, keep: true })));
      if (!r.entries.length) setError("AI 在資料中沒有找到追蹤清單股票的相關資訊。");
      if (r.skipped) setNotice(`另有 ${r.skipped} 筆資訊不屬於追蹤清單中的股票，已略過。`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const patch = (id: number, p: Partial<Row>) =>
    setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // 逐筆寫入；成功的從草稿移除，失敗的留著讓使用者修改後再送
  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    let left = rows;
    let written = 0;
    for (const r of rows.filter((x) => x.keep)) {
      try {
        await onAdd(r.code, {
          date: r.date,
          category: r.category,
          status: r.status,
          dueDate: DUE_CATEGORIES.includes(r.category) ? r.dueDate : "",
          text: r.text.trim(),
        });
        left = left.filter((x) => x.id !== r.id);
        written++;
      } catch (e) {
        setError(`有一筆寫入失敗：${(e as Error).message}`);
        break;
      }
    }
    setRows(left.length ? left : null);
    if (written) setNotice(`已寫入 ${written} 筆筆記。`);
    if (!left.length) {
      setFiles([]);
      setText("");
    }
    setSaving(false);
  }

  const kept = rows?.filter((r) => r.keep).length ?? 0;
  const nameOf = (code: string) => stocks.find((s) => s.code === code)?.name ?? code;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card flex w-full items-center justify-between px-4 py-3 text-left transition hover:border-accent"
      >
        <span className="font-bold">
          AI 擷取筆記{" "}
          <span className="ml-1 text-xs font-normal text-muted">上傳簡報、截圖或文章，AI 判斷是哪一檔並寫入它的筆記</span>
        </span>
        <span className="text-sm text-accent">展開</span>
      </button>
    );
  }

  return (
    <section
      className="card space-y-3 p-4"
      onPaste={(e) => {
        // 直接 Ctrl+V 貼上截圖
        const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
        if (imgs.length) {
          e.preventDefault();
          addFiles(imgs);
        }
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">
          AI 擷取筆記{" "}
          <span className="ml-1 text-xs font-normal text-muted">AI 會判斷資料屬於追蹤清單中的哪一檔，寫入它的筆記</span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={onOpenSettings} className="text-muted hover:text-fg">
            {settings ? `模型 ${settings.model}・設定` : "尚未設定 OpenAI API Key"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-fg">
            收合
          </button>
        </div>
      </div>

      <input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        maxLength={1000}
        placeholder="指令（選填），例如：整理這份產業報告中各家公司的 Q4 財測與擴產時程"
        className="field w-full"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={50_000}
        rows={3}
        placeholder="也可以直接貼上新聞或文章內容（選填）"
        className="field w-full resize-y leading-relaxed"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed px-4 py-4 text-center text-sm transition ${
          dragging ? "border-accent bg-accent-soft" : "border-line text-muted"
        }`}
      >
        把檔案拖到這裡、直接貼上截圖，或{" "}
        <button type="button" onClick={() => inputRef.current?.click()} className="text-accent underline underline-offset-4">
          選擇檔案
        </button>
        <div className="mt-1 text-xs">圖片、PDF、TXT／MD／CSV／JSON，最多 {MAX_FILES} 個，單檔 10 MB</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // 同一個檔案移除後還能再選
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-3 pr-1 text-xs">
              <span className="max-w-48 truncate">{f.name || "貼上的圖片"}</span>
              <span className="text-muted">{sizeLabel(f.size)}</span>
              <button
                type="button"
                onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                aria-label={`移除 ${f.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-up-soft hover:text-up"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={extract}
          disabled={busy || saving || (!text.trim() && files.length === 0)}
          className="btn-primary"
        >
          {busy ? "AI 擷取中…" : settings ? "AI 擷取" : "先設定 API Key"}
        </button>
        <span className="text-xs text-muted">Key 只存在這個瀏覽器，費用由你的 OpenAI 帳戶負擔。</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-muted">{notice}</p>}

      {rows && rows.length > 0 && (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-sm text-muted">AI 整理出 {rows.length} 筆草稿（{[...new Set(rows.map((r) => nameOf(r.code)))].join("、")}），請確認股票與內容後再寫入：</p>
          {rows.map((r) => (
            <div key={r.id} className={`space-y-2 rounded-xl border border-line p-3 ${r.keep ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={r.keep} onChange={(e) => patch(r.id, { keep: e.target.checked })} />
                  寫入
                </label>
                <div className="w-36">
                  <select
                    value={r.code}
                    onChange={(e) => patch(r.id, { code: e.target.value })}
                    aria-label="股票"
                    className="field py-1 text-xs font-medium"
                  >
                    {stocks.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-36">
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => patch(r.id, { date: e.target.value })}
                    aria-label="日期"
                    className="field py-1 text-xs"
                  />
                </div>
                <div className="w-24">
                  <select
                    value={r.category}
                    onChange={(e) => patch(r.id, { category: e.target.value })}
                    aria-label="分類"
                    className="field py-1 text-xs"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <select
                    value={r.status}
                    onChange={(e) => patch(r.id, { status: e.target.value })}
                    aria-label="進度"
                    className="field py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {DUE_CATEGORIES.includes(r.category) && (
                  <label className="flex items-center gap-1.5 text-muted">
                    預計完成
                    <div className="w-36">
                      <input
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => patch(r.id, { dueDate: e.target.value })}
                        className="field py-1 text-xs"
                      />
                    </div>
                  </label>
                )}
              </div>
              <textarea
                value={r.text}
                onChange={(e) => patch(r.id, { text: e.target.value })}
                maxLength={1000}
                rows={2}
                aria-label="內容"
                className="field w-full resize-y text-sm leading-relaxed"
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || kept === 0 || rows.some((r) => r.keep && (!r.text.trim() || !r.date))}
              className="btn-primary"
            >
              {saving ? "寫入中…" : `寫入筆記（${kept} 筆）`}
            </button>
            <button type="button" onClick={() => setRows(null)} className="text-sm text-muted hover:text-fg">
              放棄草稿
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
