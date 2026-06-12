"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/lib/types";

export default function WorkspaceHeader({
  wsId,
  workspaces,
  isAdmin,
  isSuperAdmin,
  userName,
}: {
  wsId: string;
  workspaces: Workspace[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const links = [
    { href: `/w/${wsId}`, label: "Úkoly" },
    { href: `/w/${wsId}/time`, label: "Můj čas" },
    ...(isAdmin
      ? [
          { href: `/w/${wsId}/reports`, label: "Přehledy" },
          { href: `/w/${wsId}/projects`, label: "Projekty" },
          { href: `/w/${wsId}/members`, label: "Členové" },
        ]
      : []),
  ];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <span className="font-display text-lg font-bold tracking-tight">
          Toggled<span className="text-accent">.</span>
        </span>
        {workspaces.length > 1 ? (
          <select
            value={wsId}
            onChange={(e) => router.push(`/w/${e.target.value}`)}
            className="input px-2 py-1"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-ink-soft">{workspaces[0]?.name}</span>
        )}
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-2 py-1 text-sm ${
                pathname === l.href
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-soft hover:bg-black/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-2 py-1 text-sm text-amber-700 hover:bg-amber-50"
            >
              Správa
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
          <span>{userName}</span>
          <button
            onClick={logout}
            className="rounded-md px-2 py-1 hover:bg-black/5"
          >
            Odhlásit
          </button>
        </div>
      </div>
    </header>
  );
}
