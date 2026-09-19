import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/user";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  // 註冊驗證碼放在環境變數 REGISTER_CODE，一定要在伺服器端檢查，前端的檢查可以被繞過。
  // 沒設定時直接拒絕所有註冊（fail closed），避免誤開放。
  const expectedCode = process.env.REGISTER_CODE;
  if (!expectedCode) {
    return Response.json({ error: "伺服器尚未設定註冊驗證碼（REGISTER_CODE）" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const verifyCode = String(body?.verifyCode ?? "").trim();

  if (verifyCode !== expectedCode) {
    return Response.json({ error: "驗證碼錯誤" }, { status: 403 });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return Response.json({ error: "Email 格式錯誤" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "密碼至少 6 個字元" }, { status: 400 });
  }
  // bcrypt 只處理前 72 bytes，超過的部分會被忽略，直接拒絕比較誠實
  if (Buffer.byteLength(password) > 72) {
    return Response.json({ error: "密碼太長（上限 72 bytes）" }, { status: 400 });
  }

  try {
    await connectDB();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ email, passwordHash });

    const sessionUser = { id: String(user._id), email: user.email };
    await setSessionCookie(sessionUser);
    return Response.json({ user: sessionUser }, { status: 201 });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return Response.json({ error: "這個 Email 已經註冊過了" }, { status: 409 });
    }
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
