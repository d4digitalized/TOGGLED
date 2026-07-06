// Cron: ranní denní přehled — karty po termínu a s termínem dnes,
// jeden e-mail na řešitele. Volá Vercel Cron (Bearer CRON_SECRET).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_URL, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

type DigestTask = {
  id: string;
  title: string;
  due_date: string;
  assignee_id: string;
  workspace_id: string;
  project_id: string;
  projects: { name: string } | null;
};

function taskList(tasks: DigestTask[]): string {
  return tasks
    .map(
      (t) =>
        `<li style="margin:4px 0;font-size:14px;">
          <a href="${APP_URL}/w/${t.workspace_id}/b/${t.project_id}" style="color:#1f2328;text-decoration:none;"><strong>${escapeHtml(t.title)}</strong></a>
          <span style="color:#5c636b;"> · ${escapeHtml(t.projects?.name ?? "")} · ${new Date(`${t.due_date}T00:00`).toLocaleDateString("cs-CZ")}</span>
        </li>`
    )
    .join("");
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, assignee_id, workspace_id, project_id, projects(name)")
    .is("completed_at", null)
    .is("parent_id", null)
    .not("assignee_id", "is", null)
    .lte("due_date", today);
  const tasks = (data ?? []) as unknown as DigestTask[];
  if (tasks.length === 0) return NextResponse.json({ users: 0, sent: 0 });

  const byUser = new Map<string, DigestTask[]>();
  for (const t of tasks) {
    byUser.set(t.assignee_id, [...(byUser.get(t.assignee_id) ?? []), t]);
  }

  const userIds = [...byUser.keys()];
  const [profilesRes, prefsRes] = await Promise.all([
    supabase.from("profiles").select("id, email").in("id", userIds),
    supabase.from("notification_prefs").select("user_id, daily_digest").in("user_id", userIds),
  ]);
  const emailById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, p.email as string])
  );
  const digestOff = new Set(
    (prefsRes.data ?? []).filter((p) => !p.daily_digest).map((p) => p.user_id as string)
  );

  let sent = 0;
  for (const [userId, userTasks] of byUser) {
    const email = emailById.get(userId);
    if (!email || digestOff.has(userId)) continue;

    const overdue = userTasks.filter((t) => t.due_date < today);
    const dueToday = userTasks.filter((t) => t.due_date === today);
    const sections = [
      overdue.length
        ? `<p style="margin:12px 0 4px;font-size:13px;font-weight:600;color:#c2410c;">Po termínu (${overdue.length})</p><ul style="margin:0;padding-left:18px;">${taskList(overdue)}</ul>`
        : "",
      dueToday.length
        ? `<p style="margin:12px 0 4px;font-size:13px;font-weight:600;">Dnes (${dueToday.length})</p><ul style="margin:0;padding-left:18px;">${taskList(dueToday)}</ul>`
        : "",
    ].join("");

    try {
      await sendEmail(
        email,
        `Toggled: ${userTasks.length} ${userTasks.length === 1 ? "karta" : userTasks.length < 5 ? "karty" : "karet"} k dnešku`,
        emailLayout("Tvůj denní přehled", sections)
      );
      sent += 1;
    } catch (err) {
      console.error("digest cron:", err);
    }
  }

  return NextResponse.json({ users: byUser.size, sent });
}
