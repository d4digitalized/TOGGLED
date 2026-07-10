"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { posBetween } from "@/lib/position";
import { toast } from "@/lib/toast";
import { pingNotifyEmails } from "@/lib/notify";
import { PRIORITIES } from "@/lib/priority";
import { cacheGet, cacheSet } from "@/lib/viewCache";
import { TASKS_CHANGED_EVENT } from "@/lib/tasksChanged";
import ProjectPicker, { ProjectDot } from "@/components/ProjectPicker";
import PersonPicker, {
  isMemberRef,
  personRefId,
  type PersonRef,
} from "@/components/PersonPicker";
import Avatar from "@/components/Avatar";
import TaskRow, { TaskGroup } from "@/components/TaskRow";
import type { Contact, Membership, Project, Task } from "@/lib/types";

// Modal karty se dogeneruje až při otevření (mimo základní bundle routy).
const CardModal = dynamic(() => import("@/components/CardModal"), { ssr: false });

type Status = "active" | "done" | "all";

export default function TasksView({
  wsId,
  userId,
  isAdmin,
}: {
  wsId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const cacheKey = `tasks:${wsId}`;
  const cached = cacheGet<{
    tasks: Task[];
    projects: Project[];
    members: Membership[];
    assignees: Record<string, string[]>;
  }>(cacheKey);
  const [tasks, setTasks] = useState<Task[]>(cached?.tasks ?? []);
  const [projects, setProjects] = useState<Project[]>(cached?.projects ?? []);
  const [members, setMembers] = useState<Membership[]>(cached?.members ?? []);
  const [assignees, setAssignees] = useState<Record<string, string[]>>(
    cached?.assignees ?? {}
  );
  const [loading, setLoading] = useState(!cached);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  // můj tým: já + lidé, kterým smím zadávat (assign_grants); admin vidí všechny
  const [grants, setGrants] = useState<Set<string>>(new Set());
  // zadání nového úkolu (admin)
  const [addTitle, setAddTitle] = useState("");
  const [addProject, setAddProject] = useState("");
  const [addAssignee, setAddAssignee] = useState<PersonRef | null>(null);
  const [addProjMembers, setAddProjMembers] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Contact[]>([]);
  // filtry
  const [fText, setFText] = useState("");
  const [fProject, setFProject] = useState("");
  const [fPriority, setFPriority] = useState(0);
  const [fAssignee, setFAssignee] = useState("");
  const [fStatus, setFStatus] = useState<Status>("active");

  const load = useCallback(async () => {
    const [taskRes, projRes, memRes, taRes, grantRes, contactRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, projects(name, position), board_columns(name)")
        .eq("workspace_id", wsId)
        .is("parent_id", null),
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
          "*, profiles(id, email, full_name, is_super_admin, avatar_initials, avatar_color, tag_name)"
        )
        .eq("workspace_id", wsId),
      supabase
        .from("task_assignees")
        .select("task_id, user_id, tasks!inner(workspace_id)")
        .eq("tasks.workspace_id", wsId),
      supabase
        .from("assign_grants")
        .select("target_id")
        .eq("workspace_id", wsId)
        .eq("user_id", userId),
      supabase.from("contacts").select("*").eq("workspace_id", wsId).order("name"),
    ]);
    const nextTasks = (taskRes.data as Task[]) ?? [];
    const nextProjects = (projRes.data as Project[]) ?? [];
    const nextMembers = (memRes.data as unknown as Membership[]) ?? [];
    const byTask: Record<string, string[]> = {};
    for (const row of taRes.data ?? []) {
      byTask[row.task_id] = [...(byTask[row.task_id] ?? []), row.user_id as string];
    }
    setTasks(nextTasks);
    setProjects(nextProjects);
    setMembers(nextMembers);
    setAssignees(byTask);
    setGrants(new Set((grantRes.data ?? []).map((r) => r.target_id as string)));
    setContacts((contactRes.data as Contact[]) ?? []);
    cacheSet(cacheKey, {
      tasks: nextTasks,
      projects: nextProjects,
      members: nextMembers,
      assignees: byTask,
    });
    setLoading(false);
  }, [supabase, wsId, cacheKey]);

  useEffect(() => {
    load();
    // nový úkol z plovoucího „+" v layoutu — přenačti seznam
    const onChanged = () => load();
    window.addEventListener(TASKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, onChanged);
  }, [load]);

  // členským řešitelem smí být jen člen zvoleného projektu (nebo admin ws);
  // bez projektu kdokoli, duchové vždy
  useEffect(() => {
    if (!addProject) {
      setAddProjMembers(new Set());
      return;
    }
    supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", addProject)
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r) => r.user_id as string));
        setAddProjMembers(ids);
        setAddAssignee((prev) => {
          if (!prev || !isMemberRef(prev)) return prev;
          const id = personRefId(prev);
          const stillOk =
            ids.has(id) || members.find((m) => m.user_id === id)?.role === "admin";
          return stillOk ? prev : null;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProject]);

  const addAssignable = !addProject
    ? members
    : members.filter((m) => addProjMembers.has(m.user_id) || m.role === "admin");

  /** Nový duch z „➕ založit" v PersonPickeru — jen doplnit do seznamu. */
  function addContact(contact: Contact) {
    setContacts((prev) =>
      [...prev, contact].sort((a, b) => a.name.localeCompare(b.name, "cs"))
    );
  }

  /** „➕ založit projekt" z pickeru rychlého zadání (jen admin — RLS). */
  async function createProjectAndPick(name: string) {
    const { data, error } = await supabase
      .from("projects")
      .insert({ workspace_id: wsId, name })
      .select("id")
      .single();
    if (error || !data) {
      toast("Projekt se nepodařilo založit.", "error");
      return;
    }
    setAddProject(data.id as string);
    load();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = addTitle.trim();
    if (!title) return;
    // projektový úkol jde na konec prvního sloupce nástěnky projektu;
    // bez projektu žije mimo nástěnky (stejná logika jako Nový úkol / Inbox)
    let columnId: string | null = null;
    let position = 0;
    if (addProject) {
      const { data: col } = await supabase
        .from("board_columns")
        .select("id")
        .eq("project_id", addProject)
        .order("position")
        .limit(1)
        .maybeSingle();
      const { data: last } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", addProject)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      columnId = col?.id ?? null;
      position = posBetween(last?.position, undefined);
    }
    const { data: created, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: wsId,
        project_id: addProject || null,
        column_id: columnId,
        title,
        position,
      })
      .select("id")
      .single();
    if (error || !created) {
      toast("Úkol se nepodařilo přidat.", "error");
      return;
    }
    if (addAssignee) {
      const id = personRefId(addAssignee);
      const { error: aError } = isMemberRef(addAssignee)
        ? await supabase
            .from("task_assignees")
            .insert({ task_id: created.id, user_id: id })
        : await supabase
            .from("task_contact_assignees")
            .insert({ task_id: created.id, contact_id: id });
      if (aError) toast("Řešitele se nepodařilo přiřadit.", "error");
      else if (isMemberRef(addAssignee)) pingNotifyEmails();
    }
    setAddTitle("");
    load();
  }

  async function toggleDone(task: Task) {
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
      .eq("id", task.id);
    if (error) toast("Uložení se nezdařilo.", "error");
    else pingNotifyEmails(); // opakovaná karta může přiřadit další výskyt
    load();
  }

  if (loading) return <p className="p-4 text-ink-soft/70">Načítám…</p>;

  const q = fText.trim().toLowerCase();
  // tým = já + lidé s grantem; admin vidí všechny
  const team = new Set([userId, ...grants]);
  const teamMembers = isAdmin
    ? members
    : members.filter((m) => team.has(m.user_id));
  const visible = tasks
    .filter((t) =>
      isAdmin ? true : (assignees[t.id] ?? []).some((id) => team.has(id))
    )
    .filter((t) =>
      fStatus === "all" ? true : fStatus === "done" ? !!t.completed_at : !t.completed_at
    )
    .filter(
      (t) =>
        (!q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)) &&
        (!fProject || t.project_id === fProject) &&
        (fPriority === 0 || (t.priority ?? 4) === fPriority) &&
        (!fAssignee || (assignees[t.id] ?? []).includes(fAssignee))
    )
    .sort(
      (a, b) =>
        (a.projects?.position ?? Number.MAX_SAFE_INTEGER) -
          (b.projects?.position ?? Number.MAX_SAFE_INTEGER) ||
        (a.priority ?? 4) - (b.priority ?? 4) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
        a.title.localeCompare(b.title, "cs")
    );

  // skupiny po projektech (v pořadí řazení; bez projektu na konci)
  const projectGroups: { key: string; label: string; tasks: Task[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const t of visible) {
    const key = t.project_id ?? "none";
    if (!groupIndex.has(key)) {
      groupIndex.set(key, projectGroups.length);
      projectGroups.push({
        key,
        label: t.projects?.name ?? "Bez projektu",
        tasks: [],
      });
    }
    projectGroups[groupIndex.get(key)!].tasks.push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-lg font-semibold">Task force</h1>
        <span className="text-xs text-ink-soft/70">
          úkoly všech ve Vaší skupině
        </span>
        <span className="flex-1" />
        <input
          type="search"
          placeholder="Hledat v úkolech…"
          value={fText}
          onChange={(e) => setFText(e.target.value)}
          className="input w-44 px-2 py-1 text-sm"
        />
        <select
          value={fProject}
          onChange={(e) => setFProject(e.target.value)}
          aria-label="Filtr projektu"
          className="input px-2 py-1 text-sm"
        >
          <option value="">Projekt: vše</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={fPriority}
          onChange={(e) => setFPriority(Number(e.target.value))}
          aria-label="Filtr priority"
          className="input px-2 py-1 text-sm"
        >
          <option value={0}>Priorita: vše</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {teamMembers.length > 1 && (
          <select
            value={fAssignee}
            onChange={(e) => setFAssignee(e.target.value)}
            aria-label="Filtr řešitele"
            className="input px-2 py-1 text-sm"
          >
            <option value="">Řešitel: všichni</option>
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || m.profiles?.email}
              </option>
            ))}
          </select>
        )}
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value as Status)}
          aria-label="Filtr stavu"
          className="input px-2 py-1 text-sm"
        >
          <option value="active">Aktivní</option>
          <option value="done">Dokončené</option>
          <option value="all">Vše</option>
        </select>
      </div>

      {isAdmin && (
        <form onSubmit={addTask} className="flex flex-wrap items-center gap-2 panel py-2 pl-4 pr-2">
          <input
            type="text"
            placeholder="Nový úkol…"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            className="input-quiet -ml-2 min-w-40 flex-1 px-2 py-1.5 text-sm"
          />
          <ProjectPicker
            projects={projects}
            value={addProject || null}
            onChange={(id) => setAddProject(id ?? "")}
            align="left"
            alwaysSearch
            onCreate={createProjectAndPick}
          />
          <PersonPicker
            wsId={wsId}
            userId={userId}
            members={addAssignable}
            contacts={contacts}
            value={addAssignee}
            onChange={setAddAssignee}
            onContactCreated={addContact}
            noneLabel="Bez řešitele"
            placeholder="Řešitel"
            ariaLabel="Řešitel"
          />
          <button type="submit" className="btn-primary">
            Přidat úkol
          </button>
        </form>
      )}

      {visible.length === 0 ? (
        <p className="panel p-6 text-center text-sm text-ink-soft/70">
          Žádné úkoly neodpovídají filtrům.
        </p>
      ) : (
        projectGroups.map((group) => (
          <TaskGroup
            key={group.key}
            label={
              <span className="inline-flex items-center gap-1.5">
                <ProjectDot
                  id={group.key === "none" ? null : group.key}
                  className="h-2 w-2"
                />
                {group.label}
              </span>
            }
            count={group.tasks.length}
          >
            {group.tasks.map((task) => {
              const taskAssignees = (assignees[task.id] ?? [])
                .map((id) => members.find((m) => m.user_id === id))
                .filter((m): m is Membership => !!m);
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={setOpenTask}
                  onToggleDone={toggleDone}
                  showProject={false}
                  meta={
                    taskAssignees.length > 0 && (
                      <span className="flex -space-x-1.5">
                        {taskAssignees.slice(0, 4).map((m) => (
                          <Avatar
                            key={m.user_id}
                            profile={m.profiles}
                            colorKey={m.user_id}
                            size="sm"
                            className="border border-surface"
                          />
                        ))}
                        {taskAssignees.length > 4 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-black/10 text-[9px] font-medium text-ink-soft">
                            +{taskAssignees.length - 4}
                          </span>
                        )}
                      </span>
                    )
                  }
                />
              );
            })}
          </TaskGroup>
        ))
      )}

      {openTask && (
        <CardModal
          task={openTask}
          members={members}
          userId={userId}
          onClose={() => setOpenTask(null)}
          onChanged={() => {
            setOpenTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
