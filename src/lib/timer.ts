import type { SupabaseClient } from "@supabase/supabase-js";
import { entrySeconds, fmtClock } from "@/lib/format";
import { toast } from "@/lib/toast";

export const TIMER_CHANGED_EVENT = "kronos:timer-changed";

function notifyTimerChanged() {
  window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));
}

/** Zastaví případný běžící timer uživatele a spustí nový. */
export async function startTimer(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    workspace_id: string;
    project_id?: string | null;
    task_id?: string | null;
    task_title?: string;
    description?: string;
  }
) {
  const stoppedPrevious = await stopRunningTimer(supabase, userId, { silent: true });
  const { error } = await supabase.from("time_entries").insert({
    workspace_id: entry.workspace_id,
    project_id: entry.project_id ?? null,
    task_id: entry.task_id ?? null,
    description: entry.description ?? "",
    user_id: userId,
  });
  if (error) {
    // 23505 = unikátní index „jeden běžící timer na uživatele" → jiný timer už
    // běží (souběh / dvojklik / jiná záložka). Nehlásíme jako chybu, jen
    // necháme UI sesynchronizovat přes notifyTimerChanged níž.
    if (error.code !== "23505") {
      toast("Timer se nepodařilo spustit.", "error");
    }
  } else if (stoppedPrevious) {
    toast("Předchozí timer zastaven a uložen, měřím nový.");
  } else {
    toast(entry.task_title ? `Timer běží: ${entry.task_title}` : "Timer běží.");
  }
  notifyTimerChanged();
  return error;
}

/** Upraví projekt či popis běžícího záznamu. */
export async function updateRunningEntry(
  supabase: SupabaseClient,
  entryId: string,
  patch: { project_id?: string | null; description?: string }
) {
  const { error } = await supabase
    .from("time_entries")
    .update(patch)
    .eq("id", entryId);
  if (error) toast("Změnu se nepodařilo uložit.", "error");
  notifyTimerChanged();
  return error;
}

/** Zastaví běžící timer. Vrací true, pokud nějaký běžel a byl uložen. */
export async function stopRunningTimer(
  supabase: SupabaseClient,
  userId: string,
  opts?: { silent?: boolean }
): Promise<boolean> {
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at")
    .eq("user_id", userId)
    .is("stopped_at", null)
    .maybeSingle();

  if (!running) return false;

  const stoppedAt = new Date().toISOString();
  const { error } = await supabase
    .from("time_entries")
    .update({ stopped_at: stoppedAt })
    .eq("id", running.id);

  if (!opts?.silent) {
    if (error) {
      toast("Timer se nepodařilo zastavit.", "error");
    } else {
      toast(`Záznam uložen (${fmtClock(entrySeconds(running.started_at, stoppedAt))}).`);
    }
    notifyTimerChanged();
  }
  return !error;
}
