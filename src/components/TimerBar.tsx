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
      <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 p-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-neutral-500">
            {running.projects?.name}
          </p>
        </div>
        <span className="font-mono text-lg tabular-nums">
          {fmtClock(entrySeconds(running.started_at, null))}
        </span>
        <button
          onClick={() => stopRunningTimer(supabase, userId)}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
        >
          Stop
        </button>
      </div>
    );
  }

  if (freeOpen) {
    return (
      <form
        onSubmit={startFree}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3"
      >
        <select
          required
          value={freeProject}
          onChange={(e) => setFreeProject(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
          className="min-w-40 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
        >
          ▶ Start
        </button>
        <button
          type="button"
          onClick={() => setFreeOpen(false)}
          className="rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
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
        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:border-green-400 hover:text-green-700"
      >
        ▶ Spustit volný timer
      </button>
    </div>
  );
}
