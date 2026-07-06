// Odesílání e-mailů přes Resend (https://resend.com) — POUZE na serveru.
// Env: RESEND_API_KEY, volitelně EMAIL_FROM a NEXT_PUBLIC_APP_URL.

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://toggled.digitalized.cz";

const FROM = process.env.EMAIL_FROM ?? "Toggled <toggled@digitalized.cz>";

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
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
