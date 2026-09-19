import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/user";

// 帳號不存在時也跑一次比對，讓「帳號不存在」和「密碼錯誤」的回應時間相近
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 12);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return Response.json({ error: "請輸入 Email 和密碼" }, { status: 400 });
  }

  try {
    await connectDB();
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    // 不區分是帳號不存在還是密碼錯誤，避免被用來探測哪些 Email 已註冊
    if (!user || !ok) {
      return Response.json({ error: "Email 或密碼錯誤" }, { status: 401 });
    }

    const sessionUser = { id: String(user._id), email: user.email };
    await setSessionCookie(sessionUser);
    return Response.json({ user: sessionUser });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
