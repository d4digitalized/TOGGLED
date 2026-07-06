// Cron: odešle frontu notifikací (přiřazení karty, komentáře).
// Volá Vercel Cron s hlavičkou Authorization: Bearer ${CRON_SECRET}.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_URL, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

type QueueRow = {
  id: string;
  user_id: string;
  kind: "assigned" | "comment";
  workspace_id: string;
  project_id: string | null;
  task_title: string;
  actor_name: string;
  body: string;
};

function compose(n: QueueRow): { subject: string; html: string } {
  const link = n.project_id
    ? `${APP_URL}/w/${n.workspace_id}/b/${n.project_id}`
    : `${APP_URL}/w/${n.workspace_id}`;
  const title = escapeHtml(n.task_title);
  const actor = escapeHtml(n.actor_name || "Někdo");
  const button = `<p style="margin:16px 0 0;"><a href="${link}" style="display:inline-block;background:#0e7569;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:14px;">Otevřít nástěnku</a></p>`;

  if (n.kind === "assigned") {
    return {
      subject: `Přiřazená karta: ${n.task_title}`,
      html: emailLayout(
        "Máš novou kartu",
        `<p style="margin:0;font-size:14px;">${actor} ti přiřadil(a) kartu <strong>„${title}“</strong>.</p>${button}`
      ),
    };
  }
  return {
    subject: `Nový komentář: ${n.task_title}`,
    html: emailLayout(
      "Nový komentář",
      `<p style="margin:0 0 8px;font-size:14px;">${actor} komentoval(a) kartu <strong>„${title}“</strong>:</p>
       <blockquote style="margin:0;padding:8px 12px;background:#f5f6f7;border-left:3px solid #0e7569;border-radius:6px;font-size:14px;">${escapeHtml(n.body)}</blockquote>${button}`
    ),
  };
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .is("emailed_at", null)
    .order("created_at")
    .limit(100);
  const queue = (data ?? []) as QueueRow[];
  if (queue.length === 0) return NextResponse.json({ processed: 0, sent: 0 });

  const userIds = [...new Set(queue.map((n) => n.user_id))];
  const [profilesRes, prefsRes] = await Promise.all([
    supabase.from("profiles").select("id, email").in("id", userIds),
    supabase.from("notification_prefs").select("*").in("user_id", userIds),
  ]);
  const emailById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, p.email as string])
  );
  const prefsById = new Map(
    (prefsRes.data ?? []).map((p) => [p.user_id as string, p])
  );

  let sent = 0;
  for (const n of queue) {
    const email = emailById.get(n.user_id);
    const prefs = prefsById.get(n.user_id);
    const wants =
      n.kind === "assigned" ? (prefs?.on_assign ?? true) : (prefs?.on_comment ?? true);
    if (email && wants) {
      try {
        const { subject, html } = compose(n);
        await sendEmail(email, subject, html);
        sent += 1;
      } catch (err) {
        console.error("notify cron:", err);
        continue; // zůstává ve frontě na další běh
      }
    }
    // odesláno, nebo vypnuté v preferencích → označit jako vyřízené
    await supabase
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", n.id);
  }

  return NextResponse.json({ processed: queue.length, sent });
}
