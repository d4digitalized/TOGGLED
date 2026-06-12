"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { entrySeconds, fmtDuration } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return isoDay(new Date());
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "Tento týden",
    range: () => {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return [isoDay(monday), isoDay(now)];
    },
  },
  { label: "Tento měsíc", range: () => [firstOfMonth(), today()] },
  {
    label: "Minulý měsíc",
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDay(first), isoDay(last)];
    },
  },
];

export default function ReportsView({ wsId }: { wsId: string }) {
  const supabase = createClient();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const toExclusive = new Date(`${to}T00:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    const { data } = await supabase
      .from("time_entries")
      .select(
        "id, started_at, stopped_at, user_id, profiles(full_name, email), projects(name)"
      )
      .eq("workspace_id", wsId)
      .not("stopped_at", "is", null)
      .gte("started_at", new Date(`${from}T00:00`).toISOString())
      .lt("started_at", toExclusive.toISOString());
    setEntries((data as unknown as TimeEntry[]) ?? []);
    setLoading(false);
  }, [supabase, wsId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const byPerson = new Map<string, number>();
  const byProject = new Map<string, number>();
  let total = 0;
  for (const entry of entries) {
    const seconds = entrySeconds(entry.started_at, entry.stopped_at);
    total += seconds;
    const person = entry.profiles?.full_name || entry.profiles?.email || "?";
    byPerson.set(person, (byPerson.get(person) ?? 0) + seconds);
    const project = entry.projects?.name ?? "?";
    byProject.set(project, (byProject.get(project) ?? 0) + seconds);
  }
  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 panel p-3">
        <span className="text-sm font-medium">Období</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="input px-2 py-1"
        />
        <span className="text-ink-soft/70">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="input px-2 py-1"
        />
        <span className="hidden text-ink-soft/40 sm:inline">·</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              const [f, t] = preset.range();
              setFrom(f);
              setTo(t);
            }}
            className="rounded-md bg-black/5 px-2 py-1 text-xs text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            {preset.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-ink-soft">
          Celkem <span className="font-mono font-medium">{fmtDuration(total)} h</span>
        </span>
      </div>

      {loading ? (
        <p className="p-4 text-ink-soft/70">Načítám…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Po lidech", sorted(byPerson)],
              ["Po projektech", sorted(byProject)],
            ] as const
          ).map(([title, rows]) => (
            <div key={title} className="panel">
              <h2 className="border-b border-line/70 px-3 py-2 text-sm font-semibold">
                {title}
              </h2>
              {rows.length === 0 ? (
                <p className="p-3 text-sm text-ink-soft/70">Žádná data za období.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(([name, seconds]) => (
                      <tr key={name} className="border-b border-line/50 last:border-0">
                        <td className="px-3 py-2">{name}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {fmtDuration(seconds)} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-soft/70">
        Běžící (nezastavené) timery se do přehledu nepočítají.
      </p>
    </div>
  );
}
