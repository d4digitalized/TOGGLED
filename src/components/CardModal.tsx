"use client";

import { useCallback, useEffect, useState } from "react";
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
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl"
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
            className="flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold hover:border-neutral-300 focus:border-neutral-300"
          />
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Popis…"
          rows={4}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            onClick={play}
            className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
          >
            ▶ Spustit timer
          </button>
        </div>

        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <h3 className="text-sm font-semibold">Komentáře</h3>
          {comments.length === 0 && (
            <p className="text-xs text-neutral-400">Zatím žádné komentáře.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-neutral-50 p-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">
                  {comment.profiles?.full_name || comment.profiles?.email}
                </span>
                <span className="text-[10px] text-neutral-400">
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
                    className="ml-auto text-[10px] text-neutral-400 hover:text-red-600"
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
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
            >
              Odeslat
            </button>
          </form>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
          <button
            onClick={remove}
            className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            Smazat kartu
          </button>
          <button
            onClick={save}
            className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
