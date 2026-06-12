import type { SupabaseClient } from "@supabase/supabase-js";

export const TIMER_CHANGED_EVENT = "toggled:timer-changed";

function notifyTimerChanged() {
  window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));
}

/** Zastaví případný běžící timer uživatele a spustí nový. */
export async function startTimer(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    workspace_id: string;
    project_id: string;
    task_id?: string | null;
    description?: string;
  }
) {
  await stopRunningTimer(supabase, userId, false);
  const { error } = await supabase.from("time_entries").insert({
    workspace_id: entry.workspace_id,
    project_id: entry.project_id,
    task_id: entry.task_id ?? null,
    description: entry.description ?? "",
    user_id: userId,
  });
  notifyTimerChanged();
  return error;
}

export async function stopRunningTimer(
  supabase: SupabaseClient,
  userId: string,
  notify = true
) {
  const { error } = await supabase
    .from("time_entries")
    .update({ stopped_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("stopped_at", null);
  if (notify) notifyTimerChanged();
  return error;
}
