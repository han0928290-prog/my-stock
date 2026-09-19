"use client";

import { useState } from "react";
import Brand from "./brand";
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Brand size="lg" />
      <p className="mt-3 text-sm leading-relaxed text-muted">
        即時報價、歷史走勢、籌碼與新聞，
        <br />
        一站看完你追蹤的台股。
      </p>

      <div className="card mt-8 p-7">
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-lg py-2 font-medium transition ${
                mode === m ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
              }`}
            >
              {m === "login" ? "登入" : "註冊"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="label">EMAIL</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field mt-1.5"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="label">
              密碼{!isLogin && <span className="ml-1 opacity-70">（至少 6 個字元）</span>}
            </span>
            <input
              type="password"
              required
              minLength={isLogin ? undefined : 6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-1.5"
            />
          </label>

          {!isLogin && (
            <label className="block">
              <span className="label">註冊驗證碼</span>
              <input
                type="text"
                required
                autoComplete="off"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                className="field mt-1.5"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-up-soft px-3 py-2 text-sm text-up">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "處理中…" : isLogin ? "登入" : "建立帳號"}
          </button>
        </form>
      </div>
    </div>
  );
}
