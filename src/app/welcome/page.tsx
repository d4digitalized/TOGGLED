"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function WelcomeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // reset = obnova hesla existujícího účtu (jméno už má, neměnit)
  const isReset = searchParams.get("mode") === "reset";

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

    if (!isReset && fullName.trim()) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", userRes.user.id);
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 panel p-8 shadow-sm"
    >
      <h1 className="font-display text-2xl font-bold">
        {isReset ? "Nové heslo" : "Vítej v Kronosu"}
      </h1>
      <p className="text-sm text-ink-soft">
        {isReset
          ? "Nastav si nové heslo pro příští přihlášení."
          : "Dokonči účet: jméno a heslo pro příští přihlášení."}
      </p>
      {!isReset && (
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
      )}
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
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? "Ukládám…" : isReset ? "Uložit nové heslo" : "Uložit a pokračovat"}
      </button>
    </form>
  );
}

export default function WelcomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <Suspense>
        <WelcomeForm />
      </Suspense>
    </main>
  );
}
