// Dočasné: stav účtu + členství. Po spuštění smazat.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ID = "b40ad6a3-bf21-4e9d-987a-69b3347bfec9";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: u, error } = await admin.auth.admin.getUserById(ID);
if (error) throw error;
console.log("auth.users:");
console.log("  email:            ", u.user.email);
console.log("  email_confirmed_at:", u.user.email_confirmed_at ?? "(nepotvrzen)");
console.log("  last_sign_in_at:  ", u.user.last_sign_in_at ?? "(nikdy se nepřihlásil)");
console.log("  invited_at:       ", u.user.invited_at ?? "-");
console.log("  created_at:       ", u.user.created_at);

const { data: members } = await admin
  .from("workspace_members")
  .select("workspace_id, role, workspaces(name)")
  .eq("user_id", ID);
console.log("\nČlenství:", members?.length ? "" : "  ŽÁDNÉ");
for (const m of members ?? []) console.log(`  ${m.workspaces?.name} — ${m.role}`);
