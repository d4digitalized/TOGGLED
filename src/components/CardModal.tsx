"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startTimer } from "@/lib/timer";
import type { Membership, Task, TaskComment } from "@/lib/types";

export default function CardModal({
  task,
  members,
  userId,
  onClose,
  onChanged,
}: {
  task: Task;
  members: Membership[];
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [done, setDone] = useState(!!task.completed_at);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("task_comments")
      .select("*, profiles(full_name, email)")
      .eq("task_id", task.id)
      .order("created_at");
    setComments((data as TaskComment[]) ?? []);
  }, [supabase, task.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function save() {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: title.trim() || task.title,
        description,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        completed_at: done
          ? (task.completed_at ?? new Date().toISOString())
          : null,
      })
      .eq("id", task.id);
    if (error) {
      setError("Uložení se nezdařilo.");
      return;
    }
    onChanged();
  }

  async function remove() {
    if (!confirm(`Smazat kartu „${task.title}" včetně záznamů času a komentářů?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      setError("Smazat kartu může jen její autor nebo admin.");
      return;
    }
    onChanged();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await supabase.from("task_comments").insert({
      workspace_id: task.workspace_id,
      task_id: task.id,
      body: newComment.trim(),
    });
    setNewComment("");
    loadComments();
  }

  async function removeComment(comment: TaskComment) {
    await supabase.from("task_comments").delete().eq("id", comment.id);
    loadComments();
  }

  async function play() {
    await startTimer(supabase, userId, {
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: task.id,
      task_title: task.title,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-10"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Karta: ${task.title}`}
        tabIndex={-1}
        className="w-full max-w-lg space-y-4 rounded-xl bg-surface p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
            className="mt-1.5 h-4 w-4"
            title="Hotovo"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold hover:border-line focus:border-line"
          />
          <button
            onClick={onClose}
            aria-label="Zavřít kartu"
            className="rounded-md px-2 py-1 text-ink-soft/70 hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Popis…"
          rows={4}
          className="input w-full px-3 py-2"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="input px-2"
          >
            <option value="">Nepřiřazeno</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || m.profiles?.email}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input px-2 py-1"
          />
          <button
            onClick={play}
            className="rounded-md border border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent-soft"
          >
            ▶ Spustit timer
          </button>
        </div>

        <div className="space-y-2 border-t border-line/70 pt-3">
          <h3 className="text-sm font-semibold">Komentáře</h3>
          {comments.length === 0 && (
            <p className="text-xs text-ink-soft/70">Zatím žádné komentáře.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-paper p-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">
                  {comment.profiles?.full_name || comment.profiles?.email}
                </span>
                <span className="text-[10px] text-ink-soft/70">
                  {new Date(comment.created_at).toLocaleString("cs-CZ", {
                    day: "numeric",
                    month: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {comment.author_id === userId && (
                  <button
                    onClick={() => removeComment(comment)}
                    className="ml-auto text-[10px] text-ink-soft/70 hover:text-danger"
                  >
                    smazat
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Napsat komentář…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 input"
            />
            <button
              type="submit"
              className="btn-primary"
            >
              Odeslat
            </button>
          </form>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between border-t border-line/70 pt-3">
          <button
            onClick={remove}
            className="rounded-md px-2 py-1 text-sm text-danger hover:bg-danger/10"
          >
            Smazat kartu
          </button>
          <button
            onClick={save}
            className="btn-primary"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
