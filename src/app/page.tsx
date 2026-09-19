import { getSession } from "@/lib/auth";
import AppRoot from "./app-root";

export default async function Home() {
  const session = await getSession();
  return <AppRoot initialUser={session ? { id: session.id, email: session.email } : null} />;
}
