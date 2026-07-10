// Dočasné: výpis firem + kontrola, zda e-mail už existuje. Po spuštění smazat.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EMAIL = "kobyljansky@denular.com";

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

const { data: existing } = await admin
  .from("profiles")
  .select("id, email, full_name")
  .eq("email", EMAIL)
  .maybeSingle();
console.log(existing ? `UŽ EXISTUJE: ${JSON.stringify(existing)}` : `Volné: ${EMAIL} zatím účet nemá.`);

const { data: workspaces, error } = await admin
  .from("workspaces")
  .select("id, name")
  .order("name");
if (error) throw error;
console.log("\nFirmy:");
for (const w of workspaces ?? []) console.log(`  ${w.name}  [${w.id}]`);
