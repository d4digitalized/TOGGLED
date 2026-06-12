"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Přihlášení se nezdařilo. Zkontroluj e-mail a heslo.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 panel p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Toggled</h1>
        <p className="text-sm text-ink-soft">
          Přihlas se. Účet vzniká pozvánkou od admina.
        </p>
        <label className="block">
          <span className="text-sm font-medium">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1 w-full px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Heslo</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1 w-full px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center"
        >
          {loading ? "Přihlašuji…" : "Přihlásit se"}
        </button>
      </form>
    </main>
  );
}
