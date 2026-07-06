/** Priority karet po vzoru Todoistu: P1 nejvyšší, P4 výchozí (bez barvy).
    Barvy ladí s tokeny design systému (danger / brass / modrá z palety). */
export const PRIORITIES: { value: number; label: string; color: string | null }[] = [
  { value: 1, label: "P1 · Urgentní", color: "#c2410c" },
  { value: 2, label: "P2 · Vysoká", color: "#b45309" },
  { value: 3, label: "P3 · Střední", color: "#0369a1" },
  { value: 4, label: "P4 · Běžná", color: null },
];

export function priorityColor(priority: number): string | null {
  return PRIORITIES.find((p) => p.value === priority)?.color ?? null;
}

export const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Neopakuje se" },
  { value: "daily", label: "Denně" },
  { value: "weekdays", label: "V pracovní dny" },
  { value: "weekly", label: "Týdně" },
  { value: "monthly", label: "Měsíčně" },
  { value: "yearly", label: "Ročně" },
];
