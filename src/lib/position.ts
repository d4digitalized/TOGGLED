/** Frakční pozice mezi dvěma sousedy (DnD řazení bez přeindexování). */
export function posBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return next! - 1024;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}
