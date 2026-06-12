"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";

export default function BoardsList({
  wsId,
  isAdmin,
}: {
  wsId: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", wsId)
      .eq("archived", false)
      .order("name");
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [supabase, wsId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await supabase.from("projects").insert({ workspace_id: wsId, name: newName.trim() });
    setNewName("");
    load();
  }

  if (loading) return <p className="p-4 text-neutral-400">Načítám…</p>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <form
          onSubmit={add}
          className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-3"
        >
          <input
            type="text"
            placeholder="Nová nástěnka (projekt)…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Založit
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="p-4 text-sm text-neutral-400">
          {isAdmin
            ? "Žádné nástěnky. Založ první nahoře."
            : "Žádné nástěnky. Požádej admina o založení projektu."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/w/${wsId}/b/${project.id}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 font-medium shadow-sm hover:border-neutral-400"
            >
              {project.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
