import { getSession } from "@/lib/auth";

// 未登入回 { user: null }（200），前端不必處理 401
export async function GET() {
  return Response.json({ user: await getSession() });
}
