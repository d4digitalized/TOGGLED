"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { pingNotifyEmails } from "@/lib/notify";
import { cacheGet, cacheSet } from "@/lib/viewCache";
import { TASKS_CHANGED_EVENT } from "@/lib/tasksChanged";
import TaskRow, { TaskGroup, dueBuckets } from "@/components/TaskRow";
import Avatar, { type AvatarLike } from "@/components/Avatar";
import type { Membership, Task } from "@/lib/types";

// Modal se načte až při otevření karty — nezatěžuje základní bundle routy.
const CardModal = dynamic(() => import("@/components/CardModal"), { ssr: false });

export default function MyTasksView({
  wsId,
  userId,
  heading,
  profile,
}: {
  wsId: string;
  userId: string;
  heading: string;
  profile: AvatarLike | null;
}) {
  const supabase = createClient();
  const cacheKey = `mytasks:${wsId}:${userId}`;
  const cached = cacheGet<{ tasks: Task[]; members: Membership[] }>(cacheKey);
  const [tasks, setTasks] = useState<Task[]>(cached?.tasks ?? []);
  const [members, setMembers] = useState<Membership[]>(cached?.members ?? []);
  const [loading, setLoading] = useState(!cached);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    const [mineRes, memRes, fuRes] = await Promise.all([
      supabase
        .from("task_assignees")
        .select(
          "tasks!inner(*, projects(name, position), board_columns(name))"
        )
        .eq("user_id", userId)
        .eq("tasks.workspace_id", wsId)
        .is("tasks.completed_at", null)
        .is("tasks.parent_id", null),
      supabase
        .from("workspace_members")
        .select(
          "*, profiles(id, email, full_name, is_super_admin, avatar_initials, avatar_color, tag_name)"
        )
        .eq("workspace_id", wsId),
      // úkoly, kde jsem nastavil follow-up, žijí na stránce Delegované
      supabase
        .from("task_followups")
        .select("task_id")
        .eq("created_by", userId)
        .eq("workspace_id", wsId),
    ]);
    const waiting = new Set((fuRes.data ?? []).map((r) => r.task_id as string));
    const mine = ((mineRes.data ?? []) as unknown as { tasks: Task }[])
      .map((r) => r.tasks)
      .filter((t) => !waiting.has(t.id))
      .sort(
        (a, b) =>
          (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
          (a.priority ?? 4) - (b.priority ?? 4) ||
          a.title.localeCompare(b.title, "cs")
      );
    const mem = (memRes.data as unknown as Membership[]) ?? [];
    setTasks(mine);
    setMembers(mem);
    cacheSet(cacheKey, { tasks: mine, members: mem });
    setLoading(false);
  }, [supabase, wsId, userId, cacheKey]);

  useEffect(() => {
    load();
    // nový úkol z plovoucího „+" v layoutu — přenačti seznam
    const onChanged = () => load();
    window.addEventListener(TASKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, onChanged);
  }, [load]);

  async function toggleDone(task: Task) {
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) {
      toast("Uložení se nezdařilo.", "error");
      return;
    }
    toast(`Hotovo: ${task.title}`);
    pingNotifyEmails(); // opakovaná karta může přiřadit další výskyt
    load();
  }

  if (loading) return <p className="p-4 text-ink-soft/70">Načítám…</p>;

  const groups = dueBuckets(tasks);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} colorKey={userId} size="lg" />
        <div>
          <h1 className="font-display text-lg font-semibold">{heading}</h1>
          <p className="text-xs text-ink-soft/70">
            {tasks.length === 0
              ? "Žádné otevřené úkoly."
              : `${tasks.length} otevřených úkolů`}
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="panel p-8 text-center text-sm text-ink-soft/70">
          Nemáš žádné otevřené úkoly. 🎉
        </p>
      ) : (
        groups.map((group) => (
          <TaskGroup
            key={group.key}
            label={group.label}
            count={group.tasks.length}
            accent={group.accent}
          >
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={setOpenTask}
                onToggleDone={toggleDone}
              />
            ))}
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
