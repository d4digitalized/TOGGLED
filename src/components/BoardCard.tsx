"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Membership, Task } from "@/lib/types";

export default function BoardCard({
  task,
  members,
  onOpen,
  onStart,
}: {
  task: Task;
  members: Membership[];
  onOpen: () => void;
  onStart: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "card" } });

  const assignee = members.find((m) => m.user_id === task.assignee_id);
  const isDone = !!task.completed_at;
  const overdue =
    !isDone && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
  const initials = (assignee?.profiles?.full_name || assignee?.profiles?.email || "")
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`cursor-grab rounded-lg border border-line bg-surface p-2 shadow-sm hover:border-accent/50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className={`text-sm ${isDone ? "text-ink-soft/70 line-through" : ""}`}>
        {task.title}
      </p>
      {(task.due_date || assignee || !isDone) && (
        <div className="mt-1.5 flex items-center gap-2">
          {task.due_date && (
            <span
              className={`text-xs ${overdue ? "font-medium text-red-600" : "text-ink-soft/70"}`}
            >
              {new Date(task.due_date).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "numeric",
              })}
            </span>
          )}
          {task.description && <span className="text-xs text-ink-soft/50">≡</span>}
          <span className="flex-1" />
          {initials && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px] font-medium text-ink-soft">
              {initials}
            </span>
          )}
          {!isDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
              title="Spustit timer"
              className="rounded px-1 text-xs text-ink-soft/70 hover:bg-accent-soft hover:text-accent"
            >
              ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}
