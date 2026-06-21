import { useState, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "botforge_admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw) as { at: number };
    return typeof at === "number" && Date.now() - at < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

function saveSession(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() }));
}

interface Props {
  children: ReactNode;
}

export default function AdminGate({ children }: Props) {
  const [authed, setAuthed] = useState(() => isSessionValid());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authed) return;
    const id = setInterval(() => {
      if (!isSessionValid()) setAuthed(false);
    }, 60_000);
    return () => clearInterval(id);
  }, [authed]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        saveSession();
        setAuthed(true);
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Login failed.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/icon-192.png" alt="BotForge" className="w-14 h-14 rounded-2xl" />
          <div className="text-center">
            <h1 className="text-white text-xl font-bold tracking-tight">Admin Access</h1>
            <p className="text-zinc-500 text-sm mt-1">Enter your password to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            disabled={loading}
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
