"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectDot } from "@/components/ProjectPicker";
import Avatar from "@/components/Avatar";
import type { Membership, Project } from "@/lib/types";

/** Nick pro řazení koleček: @tag, jinak jméno / e-mail. */
function memberNick(m: Membership): string {
  return (
    m.profiles?.tag_name || m.profiles?.full_name || m.profiles?.email || ""
  ).toLowerCase();
}

/** Rozcestník projektů: prostý seznam s hledáním. Zakládání a archivace
    žijí ve Správě projektů (jen admin) — tady se jen prochází a otevírá. */
export default function BoardsList({
  wsId,
  isAdmin,
}: {
  wsId: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberIds, setMemberIds] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [projRes, memRes, pmRes] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("archived", false)
        .order("position")
        .order("name"),
      supabase
        .from("workspace_members")
        .select(
          "workspace_id, user_id, role, profiles(full_name, email, tag_name, avatar_initials, avatar_color)"
        )
        .eq("workspace_id", wsId),
      supabase
        .from("project_members")
        .select("project_id, user_id, projects!inner(workspace_id)")
        .eq("projects.workspace_id", wsId),
    ]);
    const byProject: Record<string, string[]> = {};
    for (const row of pmRes.data ?? []) {
      byProject[row.project_id as string] = [
        ...(byProject[row.project_id as string] ?? []),
        row.user_id as string,
      ];
    }
    setProjects((projRes.data as Project[]) ?? []);
    setMembers((memRes.data as unknown as Membership[]) ?? []);
    setMemberIds(byProject);
    setLoading(false);
  }, [supabase, wsId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="p-4 text-ink-soft/70">Načítám…</p>;

  const query = q.trim().toLowerCase();
  const visible = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query))
    : projects;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-lg font-semibold">Projekty</h1>
        <span className="text-xs text-ink-soft/70">
          {query
            ? `${visible.length} z ${projects.length}`
            : `${projects.length} aktivních`}
        </span>
        <span className="flex-1" />
        <input
          type="search"
          placeholder="Hledat projekt…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          className="input w-56 px-2 py-1 text-sm"
        />
        {isAdmin && (
          <Link href={`/w/${wsId}/projects`} className="btn-ghost px-3 py-1 text-sm">
            Správa projektů
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="panel p-6 text-sm text-ink-soft/70">
          {isAdmin
            ? "Žádné projekty. Založ první ve Správě projektů."
            : "Žádné projekty. Požádej admina o přidání na projekt."}
        </p>
      ) : visible.length === 0 ? (
        <p className="panel p-6 text-sm text-ink-soft/70">
          Nic neodpovídá hledání „{q.trim()}“.
        </p>
      ) : (
        <div className="divide-y divide-line/50 panel">
          {visible.map((project) => {
            const people = (memberIds[project.id] ?? [])
              .map((id) => members.find((m) => m.user_id === id))
              .filter((m): m is Membership => !!m && m.role !== "admin")
              .sort((a, b) => memberNick(a).localeCompare(memberNick(b), "cs"));
            return (
              <Link
                key={project.id}
                href={`/w/${wsId}/b/${project.id}`}
                title={project.name}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-black/[.02]"
              >
                <ProjectDot id={project.id} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {project.name}
                </span>
                {people.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1">
                    {people.map((m) => (
                      <Avatar
                        key={m.user_id}
                        profile={m.profiles}
                        colorKey={m.user_id}
                        size="sm"
                      />
                    ))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
