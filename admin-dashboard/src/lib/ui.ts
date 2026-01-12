import clsx from "clsx";

export function cn(...args: any[]) {
  return clsx(args);
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Intl.NumberFormat().format(n);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
