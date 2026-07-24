"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadProjectColors } from "@/lib/projectColors";

/** Nasype barvy kategorií do sdíleného registru, ať tečky projektů dědí
    barvu kategorie na všech stránkách firmy. Nic nevykresluje. */
export default function ProjectColorsLoader({ wsId }: { wsId: string }) {
  useEffect(() => {
    loadProjectColors(createClient(), wsId);
  }, [wsId]);
  return null;
}
