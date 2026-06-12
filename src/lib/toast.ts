export const TOAST_EVENT = "toggled:toast";

export type ToastKind = "success" | "error";

export type ToastDetail = { message: string; kind: ToastKind };

/** Zobrazí toast odkudkoli z klientského kódu. */
export function toast(message: string, kind: ToastKind = "success") {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } })
  );
}
