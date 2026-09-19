"use client";

import { useCallback, useState } from "react";
import AuthForm from "./auth-form";
import Dashboard from "./dashboard";
import { getJson, type AuthUser } from "./lib";

// initialUser 由伺服器讀 cookie 後傳進來，所以重新整理時不會閃一下登入畫面
export default function AppRoot({ initialUser }: { initialUser: AuthUser | null }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  const logout = useCallback(async () => {
    await getJson("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  if (!user) return <AuthForm onAuth={setUser} />;
  return <Dashboard user={user} onLogout={logout} />;
}
