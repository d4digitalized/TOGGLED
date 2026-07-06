"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { priorityColor } from "@/lib/priority";
import { projectColor } from "@/components/ProjectPicker";
import type { Label, Membership, Task } from "@/lib/types";

export default function BoardCard({
  task,
  members,
  labels = [],
  subtaskCount,
  onOpen,
  onStart,
}: {
  task: Task;
  members: Membership[];
  labels?: Label[];
  subtaskCount?: { done: number; total: number };
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
  const flag = priorityColor(task.priority ?? 4);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(flag ? { borderLeft: `3px solid ${flag}` } : {}),
      }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`cursor-grab rounded-lg border border-line bg-surface p-2 shadow-sm hover:border-accent/50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className={`text-sm ${isDone ? "text-ink-soft/70 line-through" : ""}`}>
        {task.title}
        {task.recurrence && (
          <span className="ml-1 text-xs text-ink-soft/50" title="Opakovaná karta">
            ↻
          </span>
        )}
      </p>
      {labels.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-1.5 py-px text-[10px] font-medium text-white"
              style={{ background: projectColor(label.id) }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      {(task.due_date || assignee || subtaskCount || !isDone) && (
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
          {subtaskCount && subtaskCount.total > 0 && (
            <span
              className={`text-xs ${
                subtaskCount.done === subtaskCount.total
                  ? "text-accent"
                  : "text-ink-soft/70"
              }`}
              title="Podúkoly"
            >
              ☑ {subtaskCount.done}/{subtaskCount.total}
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
              aria-label={`Spustit timer na kartě ${task.title}`}
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
