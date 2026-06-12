"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { entrySeconds, fmtClock } from "@/lib/format";
import { startTimer, stopRunningTimer, TIMER_CHANGED_EVENT } from "@/lib/timer";
import type { Project, TimeEntry } from "@/lib/types";

export default function TimerBar({
  wsId,
  userId,
}: {
  wsId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeProject, setFreeProject] = useState("");
  const [freeDescription, setFreeDescription] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("time_entries")
      .select("*, tasks(title), projects(name)")
      .eq("user_id", userId)
      .is("stopped_at", null)
      .maybeSingle();
    setRunning((data as TimeEntry) ?? null);
  }, [supabase, userId]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(TIMER_CHANGED_EVENT, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(TIMER_CHANGED_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function openFree() {
    if (projects.length === 0) {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("archived", false)
        .order("name");
      setProjects((data as Project[]) ?? []);
    }
    setFreeOpen(true);
  }

  async function startFree(e: React.FormEvent) {
    e.preventDefault();
    if (!freeProject) return;
    await startTimer(supabase, userId, {
      workspace_id: wsId,
      project_id: freeProject,
      description: freeDescription.trim(),
    });
    setFreeOpen(false);
    setFreeDescription("");
  }

  if (running) {
    const label =
      running.tasks?.title ||
      running.description ||
      running.projects?.name ||
      "Měřím čas";
    return (
      <div className="sticky top-16 z-30 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3 shadow-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-ink-soft">
            {running.projects?.name}
          </p>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums text-brass">
          {fmtClock(entrySeconds(running.started_at, null))}
        </span>
        <button
          onClick={() => stopRunningTimer(supabase, userId)}
          aria-label="Zastavit timer a uložit záznam"
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
        >
          Zastavit
        </button>
      </div>
    );
  }

  if (freeOpen) {
    return (
      <form
        onSubmit={startFree}
        className="flex flex-wrap items-center gap-2 panel p-3"
      >
        <select
          required
          value={freeProject}
          onChange={(e) => setFreeProject(e.target.value)}
          className="input px-2"
        >
          <option value="">Projekt…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Na čem děláš? (volitelné)"
          value={freeDescription}
          onChange={(e) => setFreeDescription(e.target.value)}
          className="min-w-40 flex-1 input"
        />
        <button
          type="submit"
          className="btn-primary"
        >
          ▶ Start
        </button>
        <button
          type="button"
          onClick={() => setFreeOpen(false)}
          className="rounded-md px-2 py-1.5 text-sm text-ink-soft hover:bg-black/5"
        >
          Zrušit
        </button>
      </form>
    );
  }

  return (
    <div className="flex justify-end">
      <button
        onClick={openFree}
        className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft hover:border-accent/60 hover:text-accent"
      >
        ▶ Spustit volný timer
      </button>
    </div>
  );
}
