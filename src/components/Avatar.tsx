import { projectColor } from "@/components/ProjectPicker";

/* stejná paleta jako tečky projektů — nabídka pro barvu avataru
   (členové v Členech, externí kontakty tamtéž) */
export const AVATAR_COLORS = [
  "#0e7569",
  "#b45309",
  "#0369a1",
  "#be185d",
  "#6d28d9",
  "#4d7c0f",
  "#b91c1c",
  "#475569",
];

export type AvatarLike = {
  full_name?: string | null;
  email?: string | null;
  avatar_initials?: string | null;
  avatar_color?: string | null;
};

export function avatarInitials(p: AvatarLike | null | undefined): string {
  if (p?.avatar_initials) return p.avatar_initials.toUpperCase();
  const name = p?.full_name || p?.email || "?";
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join("") || "?"
  );
}

const SIZES = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-5 w-5 text-[9px]",
  md: "h-7 w-7 text-xs",
  lg: "h-9 w-9 text-sm",
} as const;

/** Barevné kolečko s iniciálami. Bez nastavené barvy se odvodí
    stabilně z colorKey (user id) — stejná paleta jako projekty. */
export default function Avatar({
  profile,
  colorKey,
  size = "md",
  className = "",
}: {
  profile: AvatarLike | null | undefined;
  colorKey: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const color = profile?.avatar_color || projectColor(colorKey);
  const name = profile?.full_name || profile?.email || "?";
  return (
    <span
      title={name}
      style={{ background: color }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] ${SIZES[size]} ${className}`}
    >
      {avatarInitials(profile)}
    </span>
  );
}
