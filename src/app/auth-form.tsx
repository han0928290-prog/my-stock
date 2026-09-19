"use client";

import { useState } from "react";
import { getJson, type AuthUser } from "./lib";

export default function AuthForm({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await getJson<{ user: AuthUser }>(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, password, verifyCode } : { email, password }),
      });
      onAuth(r.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  const input =
    "w-full rounded-lg border border-zinc-500/40 bg-transparent px-3 py-2 outline-none focus:border-red-500";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">my-stock 台股儀表板</h1>
      <p className="mt-1 text-sm text-zinc-500">{isLogin ? "登入你的帳號" : "建立新帳號"}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 ${input}`}
          />
        </label>
        <label className="block text-sm">
          密碼{!isLogin && <span className="text-zinc-500">（至少 8 個字元）</span>}
          <input
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 ${input}`}
          />
        </label>

        {!isLogin && (
          <label className="block text-sm">
            註冊驗證碼
            <input
              type="text"
              required
              autoComplete="off"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              className={`mt-1 ${input}`}
            />
          </label>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-red-500 py-2 font-medium text-white disabled:opacity-40"
        >
          {busy ? "處理中…" : isLogin ? "登入" : "註冊"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(isLogin ? "register" : "login");
          setError(null);
        }}
        className="mt-4 text-sm text-zinc-500 underline"
      >
        {isLogin ? "還沒有帳號？註冊" : "已經有帳號？登入"}
      </button>
    </div>
  );
}
