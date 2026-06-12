"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: userRes, error: pwError } = await supabase.auth.updateUser({
      password,
    });
    if (pwError || !userRes.user) {
      setError(
        pwError?.message === "New password should be different from the old password."
          ? "Nové heslo musí být jiné než stávající."
          : "Nastavení hesla se nezdařilo. Zkus to znovu."
      );
      setLoading(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", userRes.user.id);

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 panel p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Vítej v Toggled</h1>
        <p className="text-sm text-ink-soft">
          Dokonči účet: jméno a heslo pro příští přihlášení.
        </p>
        <label className="block">
          <span className="text-sm font-medium">Celé jméno</span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input mt-1 w-full px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Heslo (min. 6 znaků)</span>
          <input
            type="password"
            required
            minLength={6}
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
          {loading ? "Ukládám…" : "Uložit a pokračovat"}
        </button>
      </form>
    </main>
  );
}
