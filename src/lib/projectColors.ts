"use client";

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Barvy projektů odvozené z jejich kategorie — sdílené pro celou aplikaci,
    ať tečka projektu vypadá stejně na nástěnce, v Task force i v Reportech.
    Projekt bez kategorie si drží barvu odvozenou z id (viz projectColor). */

const EMPTY: Record<string, string> = {};
let colors: Record<string, string> = EMPTY;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return colors;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useProjectColors(): Record<string, string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setProjectColors(next: Record<string, string>) {
  colors = next;
  for (const cb of listeners) cb();
}

/** Načte kategorie firmy a namapuje jejich barvu na projekty. Volá se při
    vstupu do firmy a po každé změně kategorií ve Správě projektů. */
export async function loadProjectColors(
  supabase: SupabaseClient,
  wsId: string
): Promise<void> {
  const [projRes, catRes] = await Promise.all([
    supabase.from("projects").select("id, category_id").eq("workspace_id", wsId),
    supabase.from("project_categories").select("id, color").eq("workspace_id", wsId),
  ]);
  // kategorie ještě nemusí být v DB (nespuštěná migrace) — pak necháme výchozí
  if (catRes.error || projRes.error) return;
  const catColor = new Map(
    (catRes.data ?? []).map((c) => [c.id as string, (c.color as string) || ""])
  );
  const next: Record<string, string> = {};
  for (const p of projRes.data ?? []) {
    const color = p.category_id ? catColor.get(p.category_id as string) : "";
    if (color) next[p.id as string] = color;
  }
  setProjectColors(next);
}
