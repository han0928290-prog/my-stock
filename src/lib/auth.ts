import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/user";

export const SESSION_COOKIE = "session";
const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 天

export type SessionUser = { id: string; email: string };

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("缺少環境變數 JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript 讀不到，避免被 XSS 偷走
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

// 只驗證 cookie 內 JWT 的簽章與效期（不查資料庫），速度快，適合頻繁呼叫的 API
export async function getTokenSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// 在 JWT 驗證之外，再確認使用者仍存在於資料庫；未登入或無效時回傳 null
export async function getSession(): Promise<SessionUser | null> {
  const session = await getTokenSession();
  if (!session) return null;

  try {
    await connectDB();
    const user = await User.findById(session.id).select("email").lean();
    return user ? { id: String(user._id), email: user.email } : null;
  } catch {
    return null;
  }
}

export const unauthorized = () => Response.json({ error: "請先登入" }, { status: 401 });
