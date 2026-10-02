import type { NextRequest } from "next/server";
import { DEFAULT_MODEL, MODEL_PATTERN, OpenAIError, requestOpenAIJson, type ContentPart } from "@/lib/ai";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { EXTRACT_PROMPT, normalizeDrafts } from "@/lib/note-extract";
import { getWatchlist } from "@/models/watchlist";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 50_000; // 貼上的文字與每個文字檔各自的字數上限

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const TEXT_EXT = /\.(txt|md|csv|json)$/i;

// 用 multipart/form-data 上傳：model、instruction、text（選填）、files（圖片／PDF／文字檔，可多個）。
// AI 會從使用者的追蹤清單判斷每筆資訊屬於哪一檔。
// BYOK：使用者自己的 OpenAI API Key 放在 x-openai-key 標頭，只用來轉送給 OpenAI，不寫入資料庫也不記錄。
// 只回傳筆記草稿，由使用者確認後再用時間軸 API 寫入。
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const apiKey = request.headers.get("x-openai-key")?.trim() ?? "";
  if (!apiKey) return Response.json({ error: "請先到設定輸入你的 OpenAI API Key" }, { status: 400 });
  if (!/^[\x21-\x7e]{20,300}$/.test(apiKey)) {
    return Response.json({ error: "OpenAI API Key 格式不正確" }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "請用表單格式上傳" }, { status: 400 });

  const model = String(form.get("model") ?? "").trim() || DEFAULT_MODEL;
  const instruction = String(form.get("instruction") ?? "").trim();
  const pasted = String(form.get("text") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!MODEL_PATTERN.test(model)) return Response.json({ error: "模型名稱格式不正確" }, { status: 400 });
  if (instruction.length > 1000) return Response.json({ error: "指令最多 1000 字" }, { status: 400 });
  if (pasted.length > MAX_TEXT) return Response.json({ error: `貼上的文字最多 ${MAX_TEXT} 字` }, { status: 400 });
  if (!pasted && files.length === 0) {
    return Response.json({ error: "請貼上文字或上傳至少一個檔案" }, { status: 400 });
  }
  if (files.length > MAX_FILES) return Response.json({ error: `一次最多 ${MAX_FILES} 個檔案` }, { status: 400 });
  if (files.some((f) => f.size > MAX_FILE_BYTES)) {
    return Response.json({ error: "單一檔案最大 10 MB" }, { status: 400 });
  }
  if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "檔案合計最大 20 MB" }, { status: 400 });
  }

  // 文字放進 <document>，圖片與 PDF 直接當成附件交給模型看
  const documents: string[] = pasted ? [`<document name="貼上的文字">\n${pasted}\n</document>`] : [];
  const attachments: ContentPart[] = [];
  for (const f of files) {
    const fileName = f.name.replace(/[<>"]/g, "").slice(0, 100) || "file";
    if (IMAGE_TYPES.includes(f.type)) {
      const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
      attachments.push({ type: "image_url", image_url: { url: `data:${f.type};base64,${b64}` } });
    } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
      attachments.push({ type: "file", file: { filename: fileName, file_data: `data:application/pdf;base64,${b64}` } });
    } else if (f.type.startsWith("text/") || TEXT_EXT.test(f.name)) {
      const text = (await f.text()).slice(0, MAX_TEXT);
      documents.push(`<document name="${fileName}">\n${text}\n</document>`);
    } else {
      return Response.json(
        { error: `不支援「${fileName}」的格式，請上傳圖片（PNG、JPG、WebP、GIF）、PDF 或文字檔（TXT、MD、CSV、JSON）` },
        { status: 400 },
      );
    }
  }

  try {
    await connectDB();
    const watchlist = await getWatchlist(session.id);
    if (!watchlist.length) return Response.json({ error: "追蹤清單是空的，先加入股票" }, { status: 400 });

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const intro = [
      `追蹤清單：\n${watchlist.map((s) => `${s.code} ${s.name}`).join("\n")}`,
      `今天日期：${today}`,
      `整理指令：${instruction || "（未指定，請擷取 EPS、財測、產能、擴廠相關資訊）"}`,
      attachments.length ? `另附 ${attachments.length} 個圖片或 PDF 檔。` : "",
      ...documents,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 圖片與 PDF 處理較久，逾時放寬到 2 分鐘
    const raw = await requestOpenAIJson(apiKey, model, EXTRACT_PROMPT, [{ type: "text", text: intro }, ...attachments], 120_000);
    const { drafts, skipped } = normalizeDrafts(raw, today, new Set(watchlist.map((s) => s.code)));
    return Response.json({ model, entries: drafts, skipped });
  } catch (e) {
    if (e instanceof OpenAIError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
