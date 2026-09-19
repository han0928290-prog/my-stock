import type { NextRequest } from "next/server";
import { callOpenAI, DEFAULT_MODEL, MODEL_PATTERN, OpenAIError } from "@/lib/ai";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { CODE_PATTERN } from "@/lib/mis";
import { buildStockContext } from "@/lib/stock-context";

// BYOK：使用者自己的 OpenAI API Key 放在 x-openai-key 標頭。
// 這裡只用來轉送給 OpenAI，不寫入資料庫、不記錄到 log，也不放進回應。
export async function POST(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const apiKey = request.headers.get("x-openai-key")?.trim() ?? "";
  if (!apiKey) {
    return Response.json({ error: "請先到設定輸入你的 OpenAI API Key" }, { status: 400 });
  }
  if (!/^[\x21-\x7e]{20,300}$/.test(apiKey)) {
    return Response.json({ error: "OpenAI API Key 格式不正確" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const model = String(body?.model ?? "").trim() || DEFAULT_MODEL;
  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }
  if (!MODEL_PATTERN.test(model)) {
    return Response.json({ error: "模型名稱格式不正確" }, { status: 400 });
  }

  try {
    const context = await buildStockContext(code);
    const analysis = await callOpenAI(apiKey, model, context.text);
    return Response.json({
      code,
      name: context.name,
      model,
      dataAsOf: context.dataAsOf,
      generatedAt: new Date().toISOString(),
      analysis,
    });
  } catch (e) {
    if (e instanceof OpenAIError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "伺服器錯誤";
    return Response.json({ error: message }, { status: message.startsWith("找不到") ? 404 : 500 });
  }
}
