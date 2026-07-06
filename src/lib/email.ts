// Odesílání e-mailů přes Resend (https://resend.com) — POUZE na serveru.
// Env: RESEND_API_KEY, volitelně EMAIL_FROM a NEXT_PUBLIC_APP_URL.

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://toggled.digitalized.cz";

const FROM = process.env.EMAIL_FROM ?? "Toggled <toggled@digitalized.cz>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

/* ---------------------------------------------------------------- odpovědi
   Odpověď na notifikační e-mail se má propsat jako komentář na kartu.
   Reply-To nese podepsaný token (task, uživatel, HMAC přes CRON_SECRET),
   inbound webhook ho ověří. Vyžaduje env REPLY_DOMAIN (Resend receiving). */

import { createHmac, timingSafeEqual } from "crypto";

export function replySignature(taskId: string, userId: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "")
    .update(`${taskId}.${userId}`)
    .digest("hex")
    .slice(0, 24);
}

/** Reply-To adresa pro kartu+příjemce, nebo null když inbound není nastaven. */
export function replyAddress(taskId: string, userId: string): string | null {
  const domain = process.env.REPLY_DOMAIN;
  if (!domain || !process.env.CRON_SECRET) return null;
  return `reply+${taskId}.${userId}.${replySignature(taskId, userId)}@${domain}`;
}

/** Ověří a rozloží token z adresy `reply+<task>.<user>.<sig>@…`. */
export function parseReplyAddress(
  address: string
): { taskId: string; userId: string } | null {
  const m = address
    .toLowerCase()
    .match(/^reply\+([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{24})@/);
  if (!m) return null;
  const [, taskId, userId, sig] = m;
  const expected = replySignature(taskId, userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { taskId, userId };
}

/** Jednotný obal e-mailu — čistý, bez obrázků, ladí s design systémem. */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="cs">
<body style="margin:0;padding:24px;background:#f5f6f7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2328;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e5e8;border-radius:12px;padding:24px;">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Toggled<span style="color:#0e7569;">.</span></p>
    <h1 style="margin:0 0 12px;font-size:16px;">${title}</h1>
    ${bodyHtml}
    <p style="margin:20px 0 0;font-size:12px;color:#5c636b;">
      Notifikace si můžeš vypnout v <a href="${APP_URL}/settings" style="color:#0e7569;">nastavení</a>.
    </p>
  </div>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
