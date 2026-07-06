"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/lib/types";

const COLLAPSED_KEY = "toggled:sidebar-collapsed";

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  board: "M4 5h7v14H4zM13 5h7v8h-7z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  chart: "M5 20V10M12 20V4M19 20v-7",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  collapse: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  expand: "M13 7l5 5-5 5M6 7l5 5-5 5",
};

export default function Sidebar({
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sections: {
    title: string;
    items: { href: string; label: string; icon: keyof typeof ICONS }[];
  }[] = [
    {
      title: "Sledování",
      items: [
        { href: `/w/${wsId}`, label: "Projekty", icon: "board" },
        { href: `/w/${wsId}/time`, label: "Report", icon: "clock" },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Analýza",
            items: [
              {
                href: `/w/${wsId}/reports`,
                label: "Přehledy",
                icon: "chart" as const,
              },
            ],
          },
          {
            title: "Správa",
            items: [
              {
                href: `/w/${wsId}/projects`,
                label: "Správa projektů",
                icon: "folder" as const,
              },
              {
                href: `/w/${wsId}/members`,
                label: "Členové",
                icon: "users" as const,
              },
            ],
          },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            title: "Admin",
            items: [
              { href: "/admin", label: "Administrace", icon: "shield" as const },
            ],
          },
        ]
      : []),
  ];

  // „Projekty" jsou aktivní i na nástěnce konkrétního projektu
  const isActive = (href: string) =>
    pathname === href ||
    (href === `/w/${wsId}` && pathname.startsWith(`/w/${wsId}/b/`));

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-tight">
            Toggled<span className="text-accent">.</span>
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Rozbalit menu" : "Sbalit menu"}
          className="ml-auto rounded-md p-1.5 text-ink-soft hover:bg-black/5"
        >
          <Icon d={collapsed ? ICONS.expand : ICONS.collapse} />
        </button>
      </div>

      {!collapsed &&
        (workspaces.length > 1 ? (
          <select
            value={wsId}
            onChange={(e) => router.push(`/w/${e.target.value}`)}
            aria-label="Přepnout workspace"
            className="input mx-3 mb-2 px-2 py-1"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mx-3 mb-2 truncate text-sm text-ink-soft">
            {workspaces[0]?.name}
          </p>
        ))}

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                  isActive(item.href)
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-soft hover:bg-black/5"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon d={ICONS[item.icon]} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div
        className={`flex items-center gap-2 border-t border-line p-3 ${
          collapsed ? "flex-col" : ""
        }`}
      >
        <span
          title={userName}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
        >
          {(userName || "?").charAt(0).toUpperCase()}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
            {userName}
          </span>
        )}
        <Link
          href="/settings"
          title="Nastavení"
          aria-label="Nastavení"
          className="rounded-md p-1.5 text-ink-soft hover:bg-black/5"
        >
          <Icon d={ICONS.gear} />
        </Link>
        <button
          onClick={logout}
          title="Odhlásit"
          aria-label="Odhlásit"
          className="rounded-md p-1.5 text-ink-soft hover:bg-black/5"
        >
          <Icon d={ICONS.logout} />
        </button>
      </div>
    </aside>
  );
}
