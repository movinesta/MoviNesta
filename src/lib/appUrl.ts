/**
 * Build an absolute URL for an in-app route that respects Vite's BASE_URL (e.g. GitHub Pages).
 *
 * Example:
 *   buildAppUrl("/title/123") => "https://example.com/MoviNesta/title/123"
 */
export function buildAppUrl(pathname: string): string {
  if (typeof window === "undefined") return pathname;

  const rawBase = (import.meta as any)?.env?.BASE_URL ?? "/";
  const base = typeof rawBase === "string" ? rawBase : "/";
  const baseNoTrail = base.endsWith("/") ? base.slice(0, -1) : base; // "/MoviNesta"
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${window.location.origin}${baseNoTrail}${path}`;
}

/**
 * Convenience helper for building a password reset redirect URL.
 */
export function buildPasswordResetRedirectUrl(): string {
  return buildAppUrl("/auth/reset-password");
}
