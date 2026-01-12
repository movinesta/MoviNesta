import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { HintIcon } from "../components/HintIcon";
import { SettingDetailDrawer } from "../components/SettingDetailDrawer";
import { Input } from "../components/Input";
import { useToast } from "../components/ToastProvider";
import { formatAdminError, applyAppSettingsPreset,
  exportAppSettings,
  getAppSettings,
  getAppSettingsHistory,
  getAppSettingsPresets,
  importAppSettings,
  previewAppSettingsPreset,
  setAppSettingsFavorites,
  updateAppSettings,
  type AppSettingsHistoryRow,
  type AppSettingsImportPreview,
  type AppSettingsPresetPreview,
  type AppSettingsPresetRow,
  type AppSettingsRegistryEntry,
  type AppSettingsRow,
} from "../lib/api";
import { cn } from "../lib/ui";
import { getSettingHint } from "../lib/settingsHints";
import { ErrorBox } from "../components/ErrorBox";
import { JsonDiff } from "../components/JsonDiff";
import { LoadingState } from "../components/LoadingState";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function prettyJson(x: any): string {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

// Stable stringify for deep equality checks in Settings UI.
// Sorts object keys recursively so comparisons aren't affected by key order.
function stableStringify(x: any): string {
  if (x === null || x === undefined) return String(x);
  const t = typeof x;
  if (t === "string") return JSON.stringify(x);
  if (t === "number" || t === "boolean") return String(x);
  if (Array.isArray(x)) return `[${x.map((v) => stableStringify(v)).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(x).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((x as any)[k])}`);
    return `{${parts.join(",")}}`;
  }
  // functions / symbols etc. should never show up in settings values
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function deepEqualStable(a: any, b: any): boolean {
  return stableStringify(a) === stableStringify(b);
}

function inferKindFromDefault(def: any): "string" | "number" | "boolean" | "json" {
  if (typeof def === "string") return "string";
  if (typeof def === "number") return "number";
  if (typeof def === "boolean") return "boolean";
  return "json";
}

function parseDraft(kind: "string" | "number" | "boolean" | "json", raw: string, boolRaw?: boolean): any {
  if (kind === "boolean") return Boolean(boolRaw);
  if (kind === "number") {
    // Preserve integers where possible (server validates ints for most numeric settings).
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Invalid number");
    return Number.isInteger(n) ? n : n;
  }
  if (kind === "json") {
    const t = raw.trim();
    if (!t) throw new Error("Empty JSON");
    return JSON.parse(t);
  }
  return raw;
}

function topCategoryKey(k: string): string {
  const parts = k.split(".");
  return parts[0] ?? "other";
}

function subCategoryKey(k: string): string {
  const parts = k.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] ?? "other";
}

function Modal(props: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-semibold tracking-tight text-zinc-900">{props.title}</div>
          <Button variant="ghost" className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100" onClick={props.onClose}>
            ✕
          </Button>
        </div>
        <div className="mt-4">{props.children}</div>
      </div>
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const routeCategory = (params as any)?.category as string | undefined;
  const isHome = !routeCategory;

  const q = useQuery({ queryKey: ["app-settings"], queryFn: getAppSettings });

  // Recent changes feed (used for "Recently changed" panel).
  const qRecentHistory = useQuery({
    queryKey: ["app-settings-history", "recent"],
    queryFn: () => getAppSettingsHistory({ limit: 20 }),
    staleTime: 10_000,
  });

  const qPresets = useQuery({
    queryKey: ["app-settings-presets"],
    queryFn: getAppSettingsPresets,
    staleTime: 30_000,
  });

  const [search, setSearch] = useState<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "public" | "admin" | "server_only">("all");
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [changedOnly, setChangedOnly] = useState<boolean>(false);

  type SortMode = "key_asc" | "last_modified_desc" | "favorites_first";
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const raw = localStorage.getItem("mn_admin_settings_sort");
    if (raw === "key_asc" || raw === "last_modified_desc" || raw === "favorites_first") return raw;
    return "key_asc";
  });
  useEffect(() => {
    try { localStorage.setItem("mn_admin_settings_sort", sortMode); } catch { /* ignore */ }
  }, [sortMode]);

  type HistoryViewMode = "side_by_side" | "diff";
  const [historyView, setHistoryView] = useState<HistoryViewMode>("side_by_side");
  const [reason, setReason] = useState<string>("");

  // Presets (apply multiple settings at once with diff preview).
  const [presetModalOpen, setPresetModalOpen] = useState<boolean>(false);
  const [presetLoadingSlug, setPresetLoadingSlug] = useState<string | null>(null);
  const [presetSlug, setPresetSlug] = useState<string | null>(null);
  const [presetRow, setPresetRow] = useState<AppSettingsPresetRow | null>(null);
  const [presetPreview, setPresetPreview] = useState<AppSettingsPresetPreview | null>(null);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetApplyReason, setPresetApplyReason] = useState<string>("");
  const [presetConfirm, setPresetConfirm] = useState<boolean>(false);
  const [presetShowAllChanges, setPresetShowAllChanges] = useState<boolean>(false);

  // Command palette (Ctrl+K) to jump to any setting by key/title/hint text.
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [paletteQuery, setPaletteQuery] = useState<string>("");
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = (e.key ?? "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => paletteInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [paletteOpen]);

  // Category route sync: /settings/:category
  // Special: /settings/favorites shows the "Favorites" view.
  useEffect(() => {
    const c = (params as any)?.category;
    if (typeof c === "string" && c.trim()) {
      if (c === "favorites") {
        setCategory("all");
        setFavoritesOnly(true);
        return;
      }
      setFavoritesOnly(false);
      setCategory(c);
      return;
    }
    setFavoritesOnly(false);
    setCategory("all");
  }, [(params as any)?.category]);
// Favorites (server-backed) with localStorage fallback.
// - We hydrate from server when available.
// - We persist updates back to server (debounced), but keep localStorage as an offline fallback.
const [favorites, setFavorites] = useState<string[]>(() => {
  try {
    const raw = localStorage.getItem("mn_admin_settings_favs_v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
});

const [favoritesHydrated, setFavoritesHydrated] = useState<boolean>(false);
const [lastSavedFavHash, setLastSavedFavHash] = useState<string>("");

const [favStorage, setFavStorage] = useState<"db" | "fallback">("fallback");
const [favLastError, setFavLastError] = useState<string | null>(null);

function favHash(xs: string[]): string {
  return xs.slice().sort().join("|");
}

useEffect(() => {
  try {
    localStorage.setItem("mn_admin_settings_favs_v1", JSON.stringify(favorites));
  } catch {
    // ignore
  }
}, [favorites]);

useEffect(() => {
  if (!q.data) return;
  const st = (q.data as any)?.favorites_storage;
  if (st === "db" || st === "fallback") setFavStorage(st);
}, [q.data]);

// Hydrate from server (and merge with local) when app-settings loads.
useEffect(() => {
  if (!q.data) return;
  const serverFavs = (q.data as any)?.favorites;
  if (!Array.isArray(serverFavs)) {
    if (!favoritesHydrated) setFavoritesHydrated(true);
    return;
  }

  // Read local favorites from storage at hydration time to avoid stale closures.
  let local: string[] = [];
  try {
    const raw = localStorage.getItem("mn_admin_settings_favs_v1");
    const parsed = raw ? JSON.parse(raw) : [];
    local = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    local = [];
  }

  const merged = Array.from(new Set([...serverFavs, ...local].filter((x) => typeof x === "string")));
  const mergedHash = favHash(merged);
  const localHash = favHash(local);
  const serverHash = favHash(serverFavs);
  if (mergedHash !== localHash) setFavorites(merged);
  const st = (q.data as any)?.favorites_storage;
  const storage: "db" | "fallback" = st === "db" ? "db" : "fallback";
  if (storage !== favStorage) setFavStorage(storage);
  setLastSavedFavHash(storage === "db" ? serverHash : mergedHash);
  setFavoritesHydrated(true);
}, [q.data]);

const mutFavSave = useMutation({
  mutationFn: async (favs: string[]) => {
    return setAppSettingsFavorites({ favorites: favs });
  },
  onSuccess: (resp) => {
    const serverFavs = resp.favorites ?? [];
    setLastSavedFavHash(favHash(serverFavs));
    if (resp.favorites_storage === "db" || resp.favorites_storage === "fallback") setFavStorage(resp.favorites_storage);
    setFavLastError(null);
  },
  onError: (e: any) => {
    setFavLastError(e?.message ?? "Failed to sync favorites");
  },
});

// Debounced server persistence (only when DB storage is available)
useEffect(() => {
  if (!favoritesHydrated) return;
  if (!q.data?.actor?.userId) return;
  if (favStorage !== "db") return;
  const h = favHash(favorites);
  if (h === lastSavedFavHash) return;
  const t = setTimeout(() => {
    mutFavSave.mutate(favorites);
  }, 500);
  return () => clearTimeout(t);
}, [favorites, favoritesHydrated, lastSavedFavHash, q.data?.actor?.userId, favStorage]);

const favoritesServerSync = useMemo(() => {
  if (favStorage !== "db") return { state: "Offline" as const, detail: "Server storage not available" };
  if (mutFavSave.isPending) return { state: "Saving" as const, detail: null };
  const diff = favoritesHydrated && favHash(favorites) !== lastSavedFavHash;
  if (favLastError) return { state: "Error" as const, detail: favLastError };
  if (diff) return { state: "Saving" as const, detail: null };
  return { state: "Saved" as const, detail: null };
}, [favStorage, mutFavSave.isPending, favoritesHydrated, favorites, lastSavedFavHash, favLastError]);

const mutPresetPreview = useMutation({
  mutationFn: async (slug: string) => previewAppSettingsPreset({ slug }),
  onSuccess: (resp, slug) => {
    setPresetLoadingSlug(null);
    setPresetSlug(slug);
    setPresetRow(resp.preset ?? null);
    setPresetPreview(resp.preview ?? null);
    setPresetMessage(resp.message ?? null);
    setPresetApplyReason("");
    setPresetConfirm(false);
    setPresetShowAllChanges(false);
    setPresetModalOpen(true);
  },
  onError: (e: any) => {
    setPresetLoadingSlug(null);
    toast.push({ variant: "error", title: "Preset preview failed", message: e?.message ?? "Could not load preset preview." });
  },
});

const mutPresetApply = useMutation({
  mutationFn: async () => {
    if (!presetSlug) throw new Error("No preset selected");
    const r = presetApplyReason.trim();
    if (!r) throw new Error("Reason is required");
    return applyAppSettingsPreset({ slug: presetSlug, expected_version: version, reason: r });
  },
  onSuccess: (resp) => {
    toast.push({
      variant: "success",
      title: "Preset applied",
      message: `${resp.preset_slug}: updated ${resp.updated_keys.length}, reset ${resp.deleted_keys.length}.`,
    });
    setPresetModalOpen(false);
    setPresetSlug(null);
    setPresetRow(null);
    setPresetPreview(null);
    setPresetMessage(null);
    setPresetApplyReason("");
    setPresetConfirm(false);

    qc.invalidateQueries({ queryKey: ["app-settings"] });
    qc.invalidateQueries({ queryKey: ["app-settings-history"] });
    qc.invalidateQueries({ queryKey: ["app-settings-history", "recent"] });
  },
  onError: (e: any) => {
    toast.push({ variant: "error", title: "Preset apply failed", message: e?.message ?? "Could not apply preset." });
  },
});

function openPreset(slug: string) {
  setPresetLoadingSlug(slug);
  setPresetMessage(null);
  setPresetPreview(null);
  setPresetRow(null);
  mutPresetPreview.mutate(slug);
}

// Export / import bundle UI
  const [exportScopes, setExportScopes] = useState<Array<"public" | "admin" | "server_only">>([
    "public",
    "admin",
    "server_only",
  ]);
  const [exportText, setExportText] = useState<string>("");

  const [importScopes, setImportScopes] = useState<Array<"public" | "admin" | "server_only">>([
    "public",
    "admin",
    "server_only",
  ]);
  const [importDeleteMissing, setImportDeleteMissing] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importPreviewOpen, setImportPreviewOpen] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<AppSettingsImportPreview | null>(null);
  const [importApplyReason, setImportApplyReason] = useState<string>("");
  const [importConfirm, setImportConfirm] = useState<boolean>(false);

  // drafts: key -> raw string (or JSON string), plus boolean toggles.
  const [draftRaw, setDraftRaw] = useState<Record<string, string>>({});
  const [draftBool, setDraftBool] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const registry = q.data?.registry ?? ({} as Record<string, AppSettingsRegistryEntry>);
  const rows = q.data?.rows ?? ([] as AppSettingsRow[]);
  const version = q.data?.version ?? 0;

  const rowByKey = useMemo(() => {
    const m = new Map<string, AppSettingsRow>();
    for (const r of rows) m.set(r.key, r);
    return m;
  }, [rows]);

  const lastModifiedByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, row] of rowByKey.entries()) {
      if (row?.updated_at) {
        const t = Date.parse(row.updated_at);
        if (Number.isFinite(t)) m.set(k, t);
      }
    }
    for (const r of qRecentHistory.data?.rows ?? []) {
      const t = Date.parse(r.changed_at);
      if (!Number.isFinite(t)) continue;
      const prev = m.get(r.key);
      if (prev === undefined || t > prev) m.set(r.key, t);
    }
    return m;
  }, [rowByKey, qRecentHistory.data]);

  // Initialize drafts once when data loads.
  useEffect(() => {
    if (!q.data) return;
    const nextRaw: Record<string, string> = {};
    const nextBool: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(registry)) {
      const row = rowByKey.get(key);
      const val = row ? row.value : entry.default;
      const kind = inferKindFromDefault(entry.default);
      if (kind === "boolean") {
        nextBool[key] = Boolean(val);
      } else if (kind === "json") {
        nextRaw[key] = prettyJson(val);
      } else {
        nextRaw[key] = val == null ? "" : String(val);
      }
    }
    setDraftRaw(nextRaw);
    setDraftBool(nextBool);
    setDirty({});
  }, [q.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(registry)) set.add(topCategoryKey(k));
    return ["all", ...Array.from(set).sort()];
  }, [registry]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of Object.keys(registry)) {
      const c = topCategoryKey(k);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [registry]);

  const paletteResults = useMemo(() => {
    if (!paletteOpen) return [] as Array<{ key: string; title: string; description: string; score: number }>;

    const qstr = paletteQuery.trim().toLowerCase();
    const keys = Object.keys(registry);
    const out: Array<{ key: string; title: string; description: string; score: number }> = [];

    for (const k of keys) {
      const entry = registry[k];
      const hint = getSettingHint(k, entry ? { default: entry.default, description: entry.description, meta: entry.meta } : undefined);
      const title = hint?.title ?? k;
      const desc = entry?.description ?? "";
      const details = hint?.details ?? "";
      const examples = (hint?.examples ?? []).map((e) => `${e.scenario} ${e.effect}`).join(" ");
      const related = (hint?.related ?? []).join(" ");
      const recommendedWhy = String((hint as any)?.recommended_why ?? "");

      const hay = `${k} ${title} ${desc} ${details} ${examples} ${related} ${recommendedWhy}`.toLowerCase();

      let score = 0;
      if (!qstr) {
        score = 1;
      } else if (k.toLowerCase() === qstr) {
        score = 2000;
      } else if (k.toLowerCase().startsWith(qstr)) {
        score = 1500;
      } else if (k.toLowerCase().includes(qstr)) {
        score = 900;
      } else if (title.toLowerCase().includes(qstr)) {
        score = 600;
      } else if (desc.toLowerCase().includes(qstr)) {
        score = 450;
      } else if (details.toLowerCase().includes(qstr)) {
        score = 350;
      } else if (hay.includes(qstr)) {
        score = 200;
      }

      if (score > 0) out.push({ key: k, title, description: desc, score });
    }

    out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    return out.slice(0, 30);
  }, [paletteOpen, paletteQuery, registry]);


const categoryChangedCounts = useMemo(() => {
  const m = new Map<string, number>();
  for (const k of Object.keys(registry)) {
    const entry = registry[k];
    const row = rowByKey.get(k);
    if (!row) continue;
    if (deepEqualStable(row.value, entry?.default)) continue;
    const c = topCategoryKey(k);
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}, [registry, rowByKey]);

  const redundantOverrideKeys = useMemo(() => {
    const out: string[] = [];
    for (const k of Object.keys(registry)) {
      const entry = registry[k];
      const row = rowByKey.get(k);
      if (!row) continue;
      if (deepEqualStable(row.value, entry?.default)) out.push(k);
    }
    out.sort();
    return out;
  }, [registry, rowByKey]);

  const keysFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const out = Object.keys(registry)
      .filter((k) => {
        if (category !== "all" && topCategoryKey(k) !== category) return false;
        if (scope !== "all" && registry[k]?.scope !== scope) return false;
        if (favoritesOnly && !favorites.includes(k)) return false;

        // "Changed from default" filter: only include settings that differ from defaults.
        if (changedOnly) {
          const entry = registry[k];
          const row = rowByKey.get(k);
          if (!row) return false; // no stored override means default behavior
          if (deepEqualStable(row.value, entry?.default)) return false;
        }

        if (!s) return true;

        const entry = registry[k];
        const d = entry?.description ?? "";
        const hint = getSettingHint(k, { default: entry?.default, description: entry?.description, meta: entry?.meta });

        const haystack = [
          k,
          d,
          hint?.title ?? "",
          hint?.details ?? "",
          hint?.recommended_why ?? "",
          hint?.caution ?? "",
          ...(hint?.related ?? []),
          ...((hint?.examples ?? []).flatMap((ex) => [ex.scenario, ex.effect])),
        ]
          .join("\n")
          .toLowerCase();

        return haystack.includes(s);
      });
    // Sort results
    if (sortMode === "key_asc") {
      out.sort();
    } else if (sortMode === "favorites_first") {
      out.sort((a, b) => {
        const af = favorites.includes(a) ? 1 : 0;
        const bf = favorites.includes(b) ? 1 : 0;
        if (bf !== af) return bf - af;
        return a.localeCompare(b);
      });
    } else if (sortMode === "last_modified_desc") {
      out.sort((a, b) => {
        const ta = lastModifiedByKey.get(a) ?? 0;
        const tb = lastModifiedByKey.get(b) ?? 0;
        if (tb !== ta) return tb - ta;
        return a.localeCompare(b);
      });
    }

    return out;
  }, [registry, search, category, scope, favoritesOnly, favorites, changedOnly, rowByKey, sortMode, lastModifiedByKey]);

  const keysGrouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const key of keysFiltered) {
      const g = subCategoryKey(key);
      const arr = m.get(g);
      if (arr) arr.push(key);
      else m.set(g, [key]);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [keysFiltered]);

  const dirtyKeys = useMemo(() => Object.keys(dirty).filter((k) => dirty[k]), [dirty]);

  function downloadText(filename: string, text: string) {
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  function toggleScope(list: Array<"public" | "admin" | "server_only">, scope: "public" | "admin" | "server_only") {
    return list.includes(scope) ? list.filter((s) => s !== scope) : [...list, scope];
  }

  function parseImportJson(raw: string): any {
    const t = raw.trim();
    if (!t) throw new Error("Import JSON is empty");
    return JSON.parse(t);
  }

  const mutExport = useMutation({
    mutationFn: async () => {
      if (!exportScopes.length) throw new Error("Select at least one scope to export");
      return exportAppSettings({ scopes: exportScopes });
    },
    onSuccess: (r) => {
      const text = prettyJson(r.bundle);
      setExportText(text);
      toast.push({ variant: "success", title: "Export ready", message: "Settings bundle generated." });
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Export failed", message: formatAdminError(e) });
    },
  });

  const mutImportPreview = useMutation({
    mutationFn: async () => {
      if (!importScopes.length) throw new Error("Select at least one scope to import");
      const bundle = parseImportJson(importText);
      return importAppSettings({
        mode: "dry_run",
        bundle,
        scopes: importScopes,
        delete_missing: importDeleteMissing,
      });
    },
    onSuccess: (r) => {
      setImportPreview(r.preview ?? null);
      setImportApplyReason("");
      setImportConfirm(false);
      setImportPreviewOpen(true);
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Preview failed", message: formatAdminError(e), durationMs: 6000 });
    },
  });

  const mutImportApply = useMutation({
    mutationFn: async () => {
      if (!importPreview) throw new Error("Run a preview first");
      if (!importConfirm) throw new Error("Confirm before applying");
      const r = importApplyReason.trim();
      if (!r) throw new Error("Reason is required");
      const bundle = parseImportJson(importText);
      return importAppSettings({
        mode: "apply",
        bundle,
        scopes: importScopes,
        delete_missing: importDeleteMissing,
        expected_version: version > 0 ? version : undefined,
        reason: r,
      });
    },
    onSuccess: async () => {
      toast.push({ variant: "success", title: "Import applied", message: "Settings updated." });
      setImportPreviewOpen(false);
      setImportPreview(null);
      setImportApplyReason("");
      setImportConfirm(false);
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Import failed", message: formatAdminError(e), durationMs: 6000 });
    },
  });

  const mutSave = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {};
      for (const key of dirtyKeys) {
        const entry = registry[key];
        if (!entry) continue;
        const kind = inferKindFromDefault(entry.default);
        const raw = draftRaw[key] ?? "";
        const b = draftBool[key];
        updates[key] = parseDraft(kind, raw, b);
      }

      return updateAppSettings({ expected_version: version > 0 ? version : undefined, updates, reason: reason.trim() || undefined });
    },
    onSuccess: async (r) => {
      const updated = (r as any)?.updated_keys?.length ?? 0;
      const deleted = (r as any)?.deleted_keys?.length ?? 0;
      const same = (r as any)?.same_keys?.length ?? 0;
      const ignored = (r as any)?.ignored_default_keys?.length ?? 0;
      const parts: string[] = [];
      if (updated) parts.push(`updated ${updated}`);
      if (deleted) parts.push(`reset ${deleted}`);
      if (same) parts.push(`no-op ${same}`);
      if (ignored) parts.push(`already default ${ignored}`);
      toast.push({ variant: "success", title: "Settings saved", message: parts.length ? parts.join(", ") + "." : "No changes." });
      setReason("");
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Save failed", message: formatAdminError(e), durationMs: 6000 });
    },
  });

  const mutCleanupRedundant = useMutation({
    mutationFn: async () => {
      if (!redundantOverrideKeys.length) throw new Error("No redundant overrides to clean");
      const updates: Record<string, any> = {};
      for (const key of redundantOverrideKeys) {
        const entry = registry[key];
        if (!entry) continue;
        updates[key] = entry.default;
      }
      const baseReason = reason.trim();
      const finalReason = baseReason ? `Cleanup redundant overrides: ${baseReason}` : "Cleanup redundant overrides";
      return updateAppSettings({ expected_version: version > 0 ? version : undefined, updates, reason: finalReason });
    },
    onSuccess: async (r) => {
      const deleted = (r as any)?.deleted_keys?.length ?? 0;
      toast.push({ variant: "success", title: "Cleaned up", message: deleted ? `Removed ${deleted} redundant override(s).` : "Nothing to remove." });
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Cleanup failed", message: formatAdminError(e) });
    },
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<AppSettingsHistoryRow[]>([]);
  const [historyDays, setHistoryDays] = useState<number>(30);
  const [historyLimit, setHistoryLimit] = useState<number>(50);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackRow, setRollbackRow] = useState<AppSettingsHistoryRow | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string>("");

  function historySinceIso(days: number): string | undefined {
    if (!days || days <= 0) return undefined;
    const ms = days * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms).toISOString();
  }

  const mutHistory = useMutation({
    mutationFn: async (payload: { key: string; limit: number; since?: string }) => getAppSettingsHistory(payload),
    onSuccess: (r) => setHistoryRows(r.rows ?? []),
    onError: (e: any) => {
      toast.push({ variant: "error", title: "History failed", message: formatAdminError(e) });
    },
  });

  const mutRollback = useMutation({
    mutationFn: async () => {
      if (!historyKey || !rollbackRow) throw new Error("No rollback target selected");
      const r = rollbackReason.trim();
      if (!r) throw new Error("Rollback reason is required");
      const entry = registry[historyKey];
      if (!entry) throw new Error("Unknown setting key");
      const value = rollbackRow.old_value === null || rollbackRow.old_value === undefined ? entry.default : rollbackRow.old_value;
      return updateAppSettings({
        expected_version: version > 0 ? version : undefined,
        updates: { [historyKey]: value },
        reason: `Rollback: ${r}`,
      });
    },
    onSuccess: async () => {
      toast.push({ variant: "success", title: "Rolled back", message: "Setting restored to the previous value." });
      setRollbackOpen(false);
      setRollbackRow(null);
      setRollbackReason("");
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
      // refresh history list to include the rollback entry
      refreshHistory();
    },
    onError: (e: any) => {
      toast.push({ variant: "error", title: "Rollback failed", message: formatAdminError(e) });
    },
  });

  function markDirty(key: string) {
    setDirty((prev) => ({ ...prev, [key]: true }));
  }

  function isFavorite(key: string): boolean {
    return favorites.includes(key);
  }

  function toggleFavorite(key: string) {
    setFavorites((prev) => {
      return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    });
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }

  async function copyKey(key: string) {
    const ok = await copyToClipboard(key);
    toast.push({
      variant: ok ? "success" : "error",
      title: ok ? "Copied" : "Copy failed",
      message: ok ? key : "Could not copy to clipboard.",
    });
  }


  function resetToDefault(key: string) {
    const entry = registry[key];
    if (!entry) return;
    const kind = inferKindFromDefault(entry.default);
    if (kind === "boolean") {
      setDraftBool((prev) => ({ ...prev, [key]: Boolean(entry.default) }));
    } else if (kind === "json") {
      setDraftRaw((prev) => ({ ...prev, [key]: prettyJson(entry.default) }));
    } else {
      setDraftRaw((prev) => ({ ...prev, [key]: String(entry.default) }));
    }
    markDirty(key);
  }

  function openHistory(key: string) {
    setHistoryKey(key);
    setHistoryOpen(true);
    setHistoryRows([]);
    mutHistory.mutate({ key, limit: historyLimit, since: historySinceIso(historyDays) });
  }

  function refreshHistory() {
    if (!historyKey) return;
    mutHistory.mutate({ key: historyKey, limit: historyLimit, since: historySinceIso(historyDays) });
  }

  function openRollback(row: AppSettingsHistoryRow) {
    if (!historyKey) return;
    // old_value == null means the previous state was the registry default (i.e., no override row).
    setRollbackRow(row);
    setRollbackReason("");
    setRollbackOpen(true);
  }

  // Setting detail drawer (the hint icon opens this).
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);

  function openDetails(key: string) {
    setDetailKey(key);
    setDetailOpen(true);
  }

  function jumpToKey(key: string, opts?: { openDetails?: boolean }) {
    const c = topCategoryKey(key);

    // Make sure the target row will be rendered (clear filters that could hide it).
    setSearch("");
    setScope("all");
    setFavoritesOnly(false);
    setChangedOnly(false);
    setPaletteOpen(false);
    setPaletteQuery("");

    setCategory(c);
    if (routeCategory !== c) navigate(`/settings/${c}`);

    if (opts?.openDetails) openDetails(key);

    // Allow render to settle before scrolling. Retry a few frames for large lists.
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`setting-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (attempts++ < 10) requestAnimationFrame(tryScroll);
    };

    setTimeout(() => requestAnimationFrame(tryScroll), 0);
  }

  function resetFilters(opts?: { keepCategory?: boolean }) {
    setSearch("");
    setScope("all");
    setFavoritesOnly(false);
    setChangedOnly(false);
    setSortMode("key_asc");
    setPaletteOpen(false);
    setPaletteQuery("");

    if (!opts?.keepCategory) {
      setCategory("all");
      navigate("/settings");
    } else {
      navigate(category === "all" ? "/settings" : `/settings/${category}`);
    }
  }



  function closeDetails() {
    setDetailOpen(false);
    setDetailKey(null);
  }

  function applyValueToDraft(key: string, value: any) {
    const entry = registry[key];
    if (!entry) return;
    const kind = inferKindFromDefault(entry.default);
    if (kind === "boolean") {
      setDraftBool((prev) => ({ ...prev, [key]: Boolean(value) }));
    } else if (kind === "json") {
      setDraftRaw((prev) => ({ ...prev, [key]: prettyJson(value) }));
    } else {
      setDraftRaw((prev) => ({ ...prev, [key]: String(value) }));
    }
    markDirty(key);
  }

  function applyRecommended(key: string) {
    const entry = registry[key];
    const h = getSettingHint(key, entry ? { default: entry.default, description: entry.description, meta: entry.meta } : undefined);
    if (h.recommended === undefined) return;
    applyValueToDraft(key, h.recommended);
  }

// Quick editor helpers for commonly-tuned knobs (still uses the same draft state + Save button).
const KEY_RATE_LIMITS = "ops.rate_limits";
const KEY_TOOL_TRUNC = "assistant.tool_result_truncation";
const KEY_RUNNER_BACKOFF = "assistant.reply_runner.backoff";
const KEY_ADMIN_USERS_PAGE_LIMIT = "admin.users.page_limit";
const KEY_ADMIN_USERS_BAN_DAYS = "admin.users.ban_duration_days";
const KEY_ADMIN_OVERVIEW_ERRORS_LIMIT = "admin.overview.recent_errors_limit";
const KEY_ADMIN_OVERVIEW_LAST_RUNS_LIMIT = "admin.overview.last_job_runs_limit";
const KEY_ADMIN_AUDIT_DEFAULT_LIMIT = "admin.audit.default_limit";

// Public UX / copy
const KEY_UX_ASSISTANT_USERNAME = "ux.assistant.username";
const KEY_UX_PRESENCE_LABEL_ONLINE = "ux.presence.label_online";
const KEY_UX_PRESENCE_LABEL_ACTIVE_RECENTLY = "ux.presence.label_active_recently";
const KEY_UX_PRESENCE_LABEL_ACTIVE_PREFIX = "ux.presence.label_active_prefix";
const KEY_UX_MESSAGES_SEARCH_MIN_CHARS = "ux.messages.search.min_query_chars";

function clampIntInput(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function getCurrentValue(key: string): any {
  const entry = registry[key];
  if (!entry) return undefined;
  const row = rowByKey.get(key);
  return row ? row.value : entry.default;
}

function getJsonDraftValue(key: string): any {
  const raw = draftRaw[key];
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return getCurrentValue(key);
}

function setJsonDraftValue(key: string, value: any) {
  setDraftRaw((prev) => ({ ...prev, [key]: prettyJson(value) }));
  markDirty(key);
}

function setRawDraftValue(key: string, raw: string) {
  setDraftRaw((prev) => ({ ...prev, [key]: raw }));
  markDirty(key);
}

function getDrawerDraftValue(key: string): any {
  const entry = registry[key];
  if (!entry) return undefined;
  // If not dirty, show the effective value.
  if (!dirty[key]) return getCurrentValue(key);
  const kind = inferKindFromDefault(entry.default);
  if (kind === "boolean") return Boolean(draftBool[key]);
  if (kind === "json") return getJsonDraftValue(key);
  const raw = (draftRaw[key] ?? "").trim();
  if (kind === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? (Number.isInteger(n) ? n : n) : raw;
  }
  return raw;
}

const qDetailHistory = useQuery({
  queryKey: ["app-settings-history", "drawer", detailKey ?? "none"],
  enabled: detailOpen && Boolean(detailKey),
  queryFn: async () => {
    if (!detailKey) return { ok: true as const, rows: [] as AppSettingsHistoryRow[] };
    return getAppSettingsHistory({ key: detailKey, limit: 5, since: historySinceIso(90) });
  },
});

  if (q.isLoading) return <LoadingState />;
if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-6">
      <Title>Settings</Title>

      <Card
        title="Export / Import settings"
        right={<div className="text-xs text-zinc-500">Current version: <span className="font-mono">{version}</span></div>}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-medium text-zinc-900">Export bundle</div>
            <div className="mt-1 text-xs text-zinc-600">Export non-secret settings as JSON for backup or promotion between environments.</div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {(["public", "admin", "server_only"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportScopes.includes(s)}
                    onChange={() => setExportScopes((prev) => toggleScope(prev, s))}
                  />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <Button onClick={() => mutExport.mutate()} disabled={mutExport.isPending}>Export</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!exportText.trim()) return;
                    navigator.clipboard?.writeText(exportText).then(() => {
                      toast.push({ variant: "success", title: "Copied", message: "Export JSON copied to clipboard." });
                    }).catch(() => {
                      toast.push({ variant: "error", title: "Copy failed", message: "Could not copy to clipboard." });
                    });
                  }}
                  disabled={!exportText.trim()}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!exportText.trim()) return;
                    const ts = new Date().toISOString().replace(/[:.]/g, "-");
                    downloadText(`movinesta-app-settings-${ts}.json`, exportText);
                  }}
                  disabled={!exportText.trim()}
                >
                  Download
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <textarea
                className="h-40 w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900"
                placeholder="Click Export to generate a bundle JSON here…"
                value={exportText}
                onChange={(e) => setExportText(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-medium text-zinc-900">Import bundle</div>
            <div className="mt-1 text-xs text-zinc-600">
              Paste a bundle JSON and run a <span className="font-medium">dry-run preview</span> before applying. This never moves secrets.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {(["public", "admin", "server_only"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importScopes.includes(s)}
                    onChange={() => setImportScopes((prev) => toggleScope(prev, s))}
                  />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={importDeleteMissing} onChange={(e) => setImportDeleteMissing(e.target.checked)} />
                <span>Delete missing keys</span>
              </label>
              <div className="ml-auto">
                <Button onClick={() => mutImportPreview.mutate()} disabled={mutImportPreview.isPending}>Preview</Button>
              </div>
            </div>

            <div className="mt-3">
              <textarea
                className="h-40 w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900"
                placeholder="Paste export JSON here…"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Recommended presets"
        right={
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div>
              Presets storage: <span className="font-mono">{qPresets.data?.presets_storage ?? "…"}</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => qc.invalidateQueries({ queryKey: ["app-settings-presets"] })}
              disabled={qPresets.isFetching}
            >
              {qPresets.isFetching ? "…" : "Refresh"}
            </Button>
          </div>
        }
      >
        <div className="text-xs text-zinc-600">
          Presets apply multiple settings in one safe action. You can preview the exact diff before applying.
        </div>

        {qPresets.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500">Loading presets…</div>
        ) : (qPresets.data?.presets_storage ?? "fallback") !== "db" ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Presets are not available until you run the migration:
            <div className="mt-2 font-mono text-[11px]">supabase/migrations/20260108_000200_app_settings_presets.sql</div>
          </div>
        ) : !(qPresets.data?.presets ?? []).length ? (
          <div className="mt-3 text-sm text-zinc-500">No presets found.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {Object.entries(
              (qPresets.data?.presets ?? []).reduce((acc, p) => {
                const g = (p.group_key ?? "general").toString();
                (acc[g] ??= []).push(p);
                return acc;
              }, {} as Record<string, AppSettingsPresetRow[]>),
            ).map(([group, presets]) => (
              <div key={group} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{group}</div>
                    <div className="mt-1 text-xs text-zinc-600">{presets.length} preset{presets.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {presets.map((p) => {
                    const count = Object.keys(p.preset ?? {}).length;
                    return (
                      <div key={p.slug} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">{p.title}</div>
                            {p.is_builtin ? (
                              <span className="rounded-lg bg-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700">Built-in</span>
                            ) : null}
                            <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">{count} keys</span>
                          </div>
                          {p.description ? <div className="mt-1 text-xs text-zinc-600">{p.description}</div> : null}
                          <div className="mt-2 font-mono text-[11px] text-zinc-500">{p.slug}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" onClick={() => openPreset(p.slug)} disabled={mutPresetPreview.isPending}>
                            {mutPresetPreview.isPending && presetLoadingSlug === p.slug ? "Loading…" : "Preview"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={presetModalOpen}
        title={presetRow?.title ?? "Preset preview"}
        onClose={() => {
          setPresetModalOpen(false);
          setPresetConfirm(false);
        }}
      >
        {!presetRow || !presetPreview ? (
          <div className="space-y-3">
            {presetMessage ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{presetMessage}</div> : null}
            <div className="text-sm text-zinc-600">No preview loaded.</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-zinc-900">
              <div className="font-semibold">{presetRow.title}</div>
              {presetRow.description ? <div className="mt-1 text-xs text-zinc-600">{presetRow.description}</div> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span className="rounded-lg bg-zinc-100 px-2 py-1 font-mono">{presetRow.slug}</span>
                <span className="rounded-lg bg-zinc-100 px-2 py-1">{Object.keys(presetRow.preset ?? {}).length} keys</span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><div className="text-xs text-zinc-500">Update</div><div className="font-mono">{presetPreview.counts.update}</div></div>
                <div><div className="text-xs text-zinc-500">Reset</div><div className="font-mono">{presetPreview.counts.reset}</div></div>
                <div><div className="text-xs text-zinc-500">Same</div><div className="font-mono">{presetPreview.counts.same}</div></div>
                <div><div className="text-xs text-zinc-500">Already default</div><div className="font-mono">{presetPreview.counts.already_default}</div></div>
                <div><div className="text-xs text-zinc-500">Unknown</div><div className="font-mono">{presetPreview.counts.unknown}</div></div>
                <div><div className="text-xs text-zinc-500">Invalid</div><div className="font-mono">{presetPreview.counts.invalid}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input type="checkbox" checked={presetShowAllChanges} onChange={(e) => setPresetShowAllChanges(e.target.checked)} />
                  <span>Show non-changing rows</span>
                </label>
                <div className="text-xs text-zinc-500">
                  Click a row to jump to the setting.
                </div>
              </div>
            </div>

            {presetPreview.unknown_keys.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">Unknown keys (ignored)</div>
                <div className="mt-2 max-h-24 overflow-auto rounded-xl border border-amber-200 bg-white p-2 font-mono text-[11px] text-amber-900">
                  {presetPreview.unknown_keys.map((k) => <div key={k}>{k}</div>)}
                </div>
              </div>
            ) : null}

            {presetPreview.invalid_values.length ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-900">Invalid values (ignored)</div>
                <div className="mt-2 max-h-28 overflow-auto rounded-xl border border-red-200 bg-white p-2 text-[11px] text-red-900">
                  {presetPreview.invalid_values.map((x) => (
                    <div key={x.key} className="flex items-start justify-between gap-2">
                      <div className="font-mono">{x.key}</div>
                      <div className="text-right">{x.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900">Changes</div>
                <div className="text-xs text-zinc-500">
                  Showing {(
                    presetShowAllChanges
                      ? presetPreview.changes.length
                      : presetPreview.changes.filter((c) => c.change_type === "update" || c.change_type === "reset").length
                  )} rows
                </div>
              </div>
              <div className="max-h-[320px] overflow-auto rounded-xl border border-zinc-200">
                {(presetShowAllChanges
                  ? presetPreview.changes
                  : presetPreview.changes.filter((c) => c.change_type === "update" || c.change_type === "reset")
                ).slice(0, 120).map((c) => {
                  const pill =
                    c.change_type === "update"
                      ? "bg-emerald-100 text-emerald-800"
                      : c.change_type === "reset"
                        ? "bg-amber-100 text-amber-800"
                        : c.change_type === "already_default"
                          ? "bg-zinc-200 text-zinc-700"
                          : "bg-zinc-100 text-zinc-600";
                  const short = (v: any) => {
                    if (v === undefined) return "undefined";
                    if (v === null) return "DEFAULT";
                    if (typeof v === "string") return v.length > 64 ? v.slice(0, 64) + "…" : v;
                    try {
                      const s = JSON.stringify(v);
                      return s.length > 90 ? s.slice(0, 90) + "…" : s;
                    } catch {
                      return String(v);
                    }
                  };
                  return (
                    <Button variant="ghost"
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setPresetModalOpen(false);
                        jumpToKey(c.key, { openDetails: true });
                      }}
                      className="w-full border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("rounded-lg px-2 py-1 text-[11px] font-semibold", pill)}>{c.change_type}</span>
                            <span className="truncate font-mono text-[11px] text-zinc-900">{c.key}</span>
                            <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">{c.scope}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-600">
                            <span className="font-semibold">Current:</span> <span className="font-mono">{short(c.current)}</span>
                            <span className="mx-2 text-zinc-400">→</span>
                            <span className="font-semibold">Target:</span> <span className="font-mono">{short(c.target)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-[11px] text-zinc-500">{c.had_override ? "override" : "default"}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
              {presetPreview.changes.length > 120 ? (
                <div className="mt-2 text-xs text-zinc-500">Showing first 120 rows.</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Apply preset</div>
              <div className="mt-1 text-xs text-zinc-600">Applying writes to settings history and admin audit log.</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-zinc-700">Reason (required)</div>
                  <Input value={presetApplyReason} onChange={(e) => setPresetApplyReason(e.target.value)} placeholder="e.g., Switch production to high-quality assistant" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={presetConfirm} onChange={(e) => setPresetConfirm(e.target.checked)} />
                    <span>I understand this changes live settings</span>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setPresetModalOpen(false)}>Close</Button>
                <Button onClick={() => mutPresetApply.mutate()} disabled={!presetConfirm || mutPresetApply.isPending}>Apply</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={importPreviewOpen}
        title="Import preview"
        onClose={() => {
          setImportPreviewOpen(false);
          setImportConfirm(false);
        }}
      >
        {!importPreview ? (
          <div className="text-sm text-zinc-600">No preview loaded.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><div className="text-xs text-zinc-500">Adds</div><div className="font-mono">{importPreview.counts.add}</div></div>
                <div><div className="text-xs text-zinc-500">Updates</div><div className="font-mono">{importPreview.counts.update}</div></div>
                <div><div className="text-xs text-zinc-500">Deletes</div><div className="font-mono">{importPreview.counts.delete}</div></div>
                <div><div className="text-xs text-zinc-500">Same</div><div className="font-mono">{importPreview.counts.same}</div></div>
                <div><div className="text-xs text-zinc-500">Skipped (scope)</div><div className="font-mono">{importPreview.counts.skipped_scope}</div></div>
                <div><div className="text-xs text-zinc-500">Skipped (unknown)</div><div className="font-mono">{importPreview.counts.skipped_unknown}</div></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Target scopes: <span className="font-mono">{importPreview.requestedScopes.join(", ")}</span></div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Adds</div>
                <div className="max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 font-mono text-[11px]">
                  {importPreview.adds.length ? importPreview.adds.map((k) => <div key={k}>{k}</div>) : <div className="text-zinc-400">None</div>}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Updates</div>
                <div className="max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 font-mono text-[11px]">
                  {importPreview.updates.length ? importPreview.updates.map((k) => <div key={k}>{k}</div>) : <div className="text-zinc-400">None</div>}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Deletes</div>
                <div className="max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 font-mono text-[11px]">
                  {importPreview.deletes.length ? importPreview.deletes.map((k) => <div key={k}>{k}</div>) : <div className="text-zinc-400">None</div>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-medium text-zinc-900">Apply changes</div>
              <div className="mt-1 text-xs text-zinc-600">Applying writes history + admin audit log and bumps the settings version.</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-zinc-700">Reason (required)</div>
                  <Input value={importApplyReason} onChange={(e) => setImportApplyReason(e.target.value)} placeholder="e.g., Promote staging config to production" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={importConfirm} onChange={(e) => setImportConfirm(e.target.checked)} />
                    <span>I understand this changes live settings</span>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setImportPreviewOpen(false)}>Close</Button>
                <Button onClick={() => mutImportApply.mutate()} disabled={mutImportApply.isPending}>Apply</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>


<Card title="Quick editors (server-only knobs)">
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {/* Rate limits */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Rate limits</div>
        <HintIcon onClick={() => openDetails(KEY_RATE_LIMITS)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Stored as <span className="font-mono">server_only</span> settings; used by Edge Functions only.
      </div>

      {(() => {
        const v = (getJsonDraftValue(KEY_RATE_LIMITS) ?? { actions: {} }) as any;
        const cur = Number(v?.actions?.["catalog-sync"] ?? 60);
        return (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-zinc-600">catalog-sync (max / minute)</div>
            <Input
              type="number"
              min={1}
              max={6000}
              value={Number.isFinite(cur) ? String(cur) : "60"}
              onChange={(e) => {
                const nextVal = clampIntInput(e.target.value, 1, 6000, 60);
                const next = {
                  ...(v ?? {}),
                  actions: { ...(v?.actions ?? {}), "catalog-sync": nextVal },
                };
                setJsonDraftValue(KEY_RATE_LIMITS, next);
              }}
            />
            <div className="text-[11px] text-zinc-500">
              Tip: You can add more actions in the full table editor under <span className="font-mono">ops.rate_limits</span>.
            </div>
          </div>
        );
      })()}
    </div>

    {/* Tool result truncation */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Tool result truncation</div>
        <HintIcon onClick={() => openDetails(KEY_TOOL_TRUNC)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Controls how much tool output is returned (prevents huge payloads).
      </div>

      {(() => {
        const v = (getJsonDraftValue(KEY_TOOL_TRUNC) ?? {
          defaults: { maxString: 1200, maxArray: 40, maxObjectKeys: 60 },
          caps: { maxString: 4000, maxArray: 200, maxObjectKeys: 200 },
          maxDepth: 4,
        }) as any;

        const d = v?.defaults ?? {};
        const c = v?.caps ?? {};
        const md = Number(v?.maxDepth ?? 4);

        const setField = (path: "defaults" | "caps", key: "maxString" | "maxArray" | "maxObjectKeys", raw: string) => {
          const prev = (getJsonDraftValue(KEY_TOOL_TRUNC) ?? v) as any;
          const curObj = path === "defaults" ? (prev.defaults ?? {}) : (prev.caps ?? {});
          const fallback = Number(curObj?.[key] ?? (path === "defaults" ? d[key] : c[key]));
          const min = key === "maxString" ? 80 : key === "maxArray" ? 1 : 5;
          const max = key === "maxString" ? 4000 : 200;
          const nextVal = clampIntInput(raw, min, max, fallback);
          const next = {
            ...(prev ?? {}),
            [path]: { ...(curObj ?? {}), [key]: nextVal },
          };
          setJsonDraftValue(KEY_TOOL_TRUNC, next);
        };

        return (
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-zinc-600">Defaults</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[11px] text-zinc-500">maxString</div>
                  <Input type="number" min={80} max={4000} value={String(Number(d.maxString ?? 1200))} onChange={(e) => setField("defaults", "maxString", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">maxArray</div>
                  <Input type="number" min={1} max={200} value={String(Number(d.maxArray ?? 40))} onChange={(e) => setField("defaults", "maxArray", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">maxKeys</div>
                  <Input type="number" min={5} max={200} value={String(Number(d.maxObjectKeys ?? 60))} onChange={(e) => setField("defaults", "maxObjectKeys", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-600">Caps</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[11px] text-zinc-500">maxString</div>
                  <Input type="number" min={80} max={4000} value={String(Number(c.maxString ?? 4000))} onChange={(e) => setField("caps", "maxString", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">maxArray</div>
                  <Input type="number" min={1} max={200} value={String(Number(c.maxArray ?? 200))} onChange={(e) => setField("caps", "maxArray", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">maxKeys</div>
                  <Input type="number" min={5} max={200} value={String(Number(c.maxObjectKeys ?? 200))} onChange={(e) => setField("caps", "maxObjectKeys", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-600">maxDepth</div>
              <Input
                type="number"
                min={1}
                max={8}
                value={Number.isFinite(md) ? String(md) : "4"}
                onChange={(e) => {
                  const nextVal = clampIntInput(e.target.value, 1, 8, 4);
                  const prev = (getJsonDraftValue(KEY_TOOL_TRUNC) ?? v) as any;
                  setJsonDraftValue(KEY_TOOL_TRUNC, { ...(prev ?? {}), maxDepth: nextVal });
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>

    {/* Reply runner */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Reply runner</div>
        <HintIcon onClick={() => openDetails("assistant.reply_runner.backoff")} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Background assistant job worker knobs (claiming, retries, stuck reclaim, context size, backoff).
      </div>

      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] text-zinc-500">claim limit</div>
            <Input
              type="number"
              min={1}
              max={200}
              value={draftRaw["assistant.reply_runner.claim_limit_default"] ?? ""}
              onChange={(e) => setRawDraftValue("assistant.reply_runner.claim_limit_default", e.target.value)}
            />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">max attempts</div>
            <Input
              type="number"
              min={1}
              max={10}
              value={draftRaw["assistant.reply_runner.max_attempts_default"] ?? ""}
              onChange={(e) => setRawDraftValue("assistant.reply_runner.max_attempts_default", e.target.value)}
            />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">stuck minutes</div>
            <Input
              type="number"
              min={1}
              max={120}
              value={draftRaw["assistant.reply_runner.stuck_minutes"] ?? ""}
              onChange={(e) => setRawDraftValue("assistant.reply_runner.stuck_minutes", e.target.value)}
            />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">max context msgs</div>
            <Input
              type="number"
              min={1}
              max={50}
              value={draftRaw["assistant.reply_runner.max_context_messages"] ?? ""}
              onChange={(e) => setRawDraftValue("assistant.reply_runner.max_context_messages", e.target.value)}
            />
          </div>
        </div>

        {(() => {
          const v = (getJsonDraftValue(KEY_RUNNER_BACKOFF) ?? {
            base_seconds: 10,
            max_exp: 10,
            max_seconds: 3600,
            jitter_seconds: 5,
          }) as any;

          const setB = (field: "base_seconds" | "max_exp" | "max_seconds" | "jitter_seconds", raw: string) => {
            const prev = (getJsonDraftValue(KEY_RUNNER_BACKOFF) ?? v) as any;
            const fallback = Number(prev?.[field] ?? v?.[field]);
            const bounds =
              field === "base_seconds"
                ? [1, 120]
                : field === "max_exp"
                ? [1, 16]
                : field === "max_seconds"
                ? [10, 7200]
                : [0, 30];
            const nextVal = clampIntInput(raw, bounds[0], bounds[1], fallback);
            setJsonDraftValue(KEY_RUNNER_BACKOFF, { ...(prev ?? {}), [field]: nextVal });
          };

          return (
            <div>
              <div className="text-xs font-medium text-zinc-600">Backoff</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-zinc-500">base s</div>
                  <Input type="number" min={1} max={120} value={String(Number(v.base_seconds ?? 10))} onChange={(e) => setB("base_seconds", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">max exp</div>
                  <Input type="number" min={1} max={16} value={String(Number(v.max_exp ?? 10))} onChange={(e) => setB("max_exp", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">max s</div>
                  <Input type="number" min={10} max={7200} value={String(Number(v.max_seconds ?? 3600))} onChange={(e) => setB("max_seconds", e.target.value)} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">jitter s</div>
                  <Input type="number" min={0} max={30} value={String(Number(v.jitter_seconds ?? 5))} onChange={(e) => setB("jitter_seconds", e.target.value)} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  </div>
</Card>


<Card title="Quick editors (admin dashboard defaults)">
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {/* Admin Users */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Admin Users</div>
        <HintIcon onClick={() => openDetails(KEY_ADMIN_USERS_PAGE_LIMIT)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        List page size + ban duration (stored as <span className="font-mono">admin</span> settings).
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-[11px] text-zinc-500">page limit</div>
          <Input
            type="number"
            min={10}
            max={500}
            value={draftRaw[KEY_ADMIN_USERS_PAGE_LIMIT] ?? ""}
            onChange={(e) => setRawDraftValue(KEY_ADMIN_USERS_PAGE_LIMIT, e.target.value)}
          />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">ban duration (days)</div>
          <Input
            type="number"
            min={1}
            max={36500}
            value={draftRaw[KEY_ADMIN_USERS_BAN_DAYS] ?? ""}
            onChange={(e) => setRawDraftValue(KEY_ADMIN_USERS_BAN_DAYS, e.target.value)}
          />
        </div>
      </div>
    </div>

    {/* Admin Overview */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Admin Overview</div>
        <HintIcon onClick={() => openDetails(KEY_ADMIN_OVERVIEW_ERRORS_LIMIT)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Controls how many rows the overview endpoint returns.
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-zinc-500">recent errors</div>
          <Input
            type="number"
            min={1}
            max={200}
            value={draftRaw[KEY_ADMIN_OVERVIEW_ERRORS_LIMIT] ?? ""}
            onChange={(e) => setRawDraftValue(KEY_ADMIN_OVERVIEW_ERRORS_LIMIT, e.target.value)}
          />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">last job runs</div>
          <Input
            type="number"
            min={1}
            max={200}
            value={draftRaw[KEY_ADMIN_OVERVIEW_LAST_RUNS_LIMIT] ?? ""}
            onChange={(e) => setRawDraftValue(KEY_ADMIN_OVERVIEW_LAST_RUNS_LIMIT, e.target.value)}
          />
        </div>
      </div>
    </div>

    {/* Admin Audit */}
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Admin Audit</div>
        <HintIcon onClick={() => openDetails(KEY_ADMIN_AUDIT_DEFAULT_LIMIT)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Default limit for listing audit rows (request may override, still clamped).
      </div>

      <div className="mt-3">
        <div className="text-[11px] text-zinc-500">default limit</div>
        <Input
          type="number"
          min={1}
          max={200}
          value={draftRaw[KEY_ADMIN_AUDIT_DEFAULT_LIMIT] ?? ""}
          onChange={(e) => setRawDraftValue(KEY_ADMIN_AUDIT_DEFAULT_LIMIT, e.target.value)}
        />
      </div>
    </div>
  </div>
</Card>


<Card title="Quick editors (public UX / copy)">
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Assistant</div>
        <HintIcon onClick={() => openDetails(KEY_UX_ASSISTANT_USERNAME)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Public settings: affect how the client detects the assistant thread on first run.
      </div>
      <div className="mt-3">
        <div className="text-[11px] text-zinc-500">assistant username</div>
        <Input
          value={draftRaw[KEY_UX_ASSISTANT_USERNAME] ?? ""}
          onChange={(e) => setRawDraftValue(KEY_UX_ASSISTANT_USERNAME, e.target.value)}
          placeholder="movinesta"
        />
      </div>
    </div>

    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Presence labels</div>
        <HintIcon onClick={() => openDetails(KEY_UX_PRESENCE_LABEL_ONLINE)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        UI copy for online / away / last-active state.
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="text-[11px] text-zinc-500">online label</div>
          <Input value={draftRaw[KEY_UX_PRESENCE_LABEL_ONLINE] ?? ""} onChange={(e) => setRawDraftValue(KEY_UX_PRESENCE_LABEL_ONLINE, e.target.value)} />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">active recently label</div>
          <Input value={draftRaw[KEY_UX_PRESENCE_LABEL_ACTIVE_RECENTLY] ?? ""} onChange={(e) => setRawDraftValue(KEY_UX_PRESENCE_LABEL_ACTIVE_RECENTLY, e.target.value)} />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">last-active prefix</div>
          <Input value={draftRaw[KEY_UX_PRESENCE_LABEL_ACTIVE_PREFIX] ?? ""} onChange={(e) => setRawDraftValue(KEY_UX_PRESENCE_LABEL_ACTIVE_PREFIX, e.target.value)} />
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-zinc-900">Messages search</div>
        <HintIcon onClick={() => openDetails(KEY_UX_MESSAGES_SEARCH_MIN_CHARS)} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Minimum characters required to enable in-conversation search.
      </div>
      <div className="mt-3">
        <div className="text-[11px] text-zinc-500">min chars</div>
        <Input
          type="number"
          min={1}
          max={10}
          value={draftRaw[KEY_UX_MESSAGES_SEARCH_MIN_CHARS] ?? ""}
          onChange={(e) => setRawDraftValue(KEY_UX_MESSAGES_SEARCH_MIN_CHARS, e.target.value)}
        />
      </div>
    </div>
  </div>
</Card>

      <Card
        title="App settings (non-secret)"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-zinc-500">Version: <span className="font-mono">{version}</span></div>
            <Button
              variant="ghost"
              onClick={() => mutCleanupRedundant.mutate()}
              disabled={!redundantOverrideKeys.length || mutCleanupRedundant.isPending}
            >
              {mutCleanupRedundant.isPending ? "Cleaning…" : `Clean redundant (${redundantOverrideKeys.length})`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => qc.invalidateQueries({ queryKey: ["app-settings"] })}
              disabled={q.isFetching}
            >
              {q.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              onClick={() => {
                // client-side parse validation before hitting server
                try {
                  for (const key of dirtyKeys) {
                    const entry = registry[key];
                    if (!entry) continue;
                    const kind = inferKindFromDefault(entry.default);
                    parseDraft(kind, draftRaw[key] ?? "", draftBool[key]);
                  }
                } catch (e: any) {
                  toast.push({ variant: "error", title: "Invalid input", message: formatAdminError(e) });
                  return;
                }
                mutSave.mutate();
              }}
              disabled={!dirtyKeys.length || mutSave.isPending}
            >
              {mutSave.isPending ? "Saving…" : `Save (${dirtyKeys.length})`}
            </Button>
          </div>
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Browse / filters */}
          <div className="md:col-span-4 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-zinc-600">
                <span>Search</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => resetFilters()}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    Reset
                  </Button>
                  <Button variant="ghost"
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Ctrl+K
                </Button>
                </div>
              </div>
              <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search key, hint text, examples…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-zinc-600">
                  <span>Scope</span>
                  <Button variant="ghost"
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setScope("all");
                      setChangedOnly(false);
                      setFavoritesOnly(false);
                      navigate("/settings");
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    Reset
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "public", label: "Public" },
                    { value: "admin", label: "Admin" },
                    { value: "server_only", label: "Server" },
                  ].map((o) => (
                    <Button variant="ghost"
                      key={o.value}
                      type="button"
                      onClick={() => setScope(o.value as any)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[11px] font-semibold",
                        scope === o.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
                      )}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-600">Favorites</div>
                <label className="flex h-[42px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700">
                  <input type="checkbox" checked={favoritesOnly} onChange={(e) => {
                    const next = e.target.checked;
                    setFavoritesOnly(next);
                    if (next) navigate("/settings/favorites");
                    else navigate(category === "all" ? "/settings" : `/settings/${category}`);
                  }} />
                  <span>Show only</span>
                </label>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <div className="flex min-w-0 items-center gap-2">
                    <span>Sync:</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        favoritesServerSync.state === "Saved" && "bg-emerald-100 text-emerald-900",
                        favoritesServerSync.state === "Saving" && "bg-zinc-200 text-zinc-800",
                        favoritesServerSync.state === "Offline" && "bg-zinc-100 text-zinc-700",
                        favoritesServerSync.state === "Error" && "bg-rose-100 text-rose-900",
                      )}
                    >
                      {favoritesServerSync.state}
                    </span>
                    {favoritesServerSync.detail ? (
                      <span className="truncate text-zinc-500">{favoritesServerSync.detail}</span>
                    ) : null}
                  </div>
                  <Button variant="ghost"
                    type="button"
                    onClick={() => {
                      setFavLastError(null);
                      mutFavSave.mutate(favorites);
                      qc.invalidateQueries({ queryKey: ["app-settings"] });
                    }}
                    disabled={mutFavSave.isPending}
                    className={cn(
                      "shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50",
                      mutFavSave.isPending && "opacity-50",
                    )}
                  >
                    Retry
                  </Button>
                </div>
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-600">Sort</div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-2">
                  {[
                    { value: "key_asc", label: "Key" },
                    { value: "last_modified_desc", label: "Last modified" },
                    { value: "favorites_first", label: "Favorites first" },
                  ].map((o) => (
                    <Button variant="ghost"
                      key={o.value}
                      type="button"
                      onClick={() => setSortMode(o.value as any)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-semibold transition",
                        sortMode === o.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
                      )}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>


              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-600">Changed from default</div>
                <label className="flex h-[42px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700">
                  <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
                  <span>Show only overrides</span>
                  <span className="ml-auto text-xs text-zinc-500">(stored values)</span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">Categories</div>
              <div className="max-h-[260px] overflow-auto rounded-xl border border-zinc-200 bg-white p-2">
                <Button variant="ghost"
                  type="button"
                  onClick={() => {
                    setFavoritesOnly(true);
                    setCategory("all");
                    navigate("/settings/favorites");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm",
                    favoritesOnly ? "bg-zinc-900 text-white" : "hover:bg-zinc-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[14px]">⭐</span>
                    <span>Favorites</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("text-xs", favoritesOnly ? "text-white/80" : "text-zinc-500")}>
                      {favorites.filter((k) => !!registry[k]).length}
                    </span>
                  </span>
                </Button>

                <Button variant="ghost"
                  type="button"
                  onClick={() => {
                    setFavoritesOnly(false);
                    setCategory("all");
                    navigate("/settings");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm",
                    category === "all" && !favoritesOnly ? "bg-zinc-900 text-white" : "hover:bg-zinc-50",
                  )}
                >
                  <span>all</span>
                  <span className="flex items-center gap-2">
                    <span className={cn("text-xs", category === "all" && !favoritesOnly ? "text-white/80" : "text-zinc-500")}>{Object.keys(registry).length}</span>
                    {Array.from(categoryChangedCounts.values()).reduce((a, b) => a + b, 0) > 0 && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", category === "all" && !favoritesOnly ? "bg-white/15 text-white" : "bg-amber-100 text-amber-900")}>{Array.from(categoryChangedCounts.values()).reduce((a, b) => a + b, 0)}</span>
                    )}
                  </span>
                </Button>
                {categories.filter((c) => c !== "all").map((c) => (
                  <Button variant="ghost"
                    key={c}
                    type="button"
                    onClick={() => {
                      setFavoritesOnly(false);
                      setCategory(c);
                      navigate(`/settings/${c}`);
                    }}
                    className={cn(
                      "mt-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm",
                      category === c && !favoritesOnly ? "bg-zinc-900 text-white" : "hover:bg-zinc-50",
                    )}
                  >
                    <span className="truncate">{c}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("text-xs", category === c && !favoritesOnly ? "text-white/80" : "text-zinc-500")}>{categoryCounts.get(c) ?? 0}</span>
                      {(categoryChangedCounts.get(c) ?? 0) > 0 && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", category === c && !favoritesOnly ? "bg-white/15 text-white" : "bg-amber-100 text-amber-900")}>{categoryChangedCounts.get(c) ?? 0}</span>
                      )}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-600">Recently changed</div>
                <Button
                  variant="ghost"
                  onClick={() => qc.invalidateQueries({ queryKey: ["app-settings-history", "recent"] })}
                  disabled={qRecentHistory.isFetching}
                >
                  {qRecentHistory.isFetching ? "…" : "Refresh"}
                </Button>
              </div>
              <div className="max-h-[220px] overflow-auto rounded-xl border border-zinc-200 bg-white">
                {(qRecentHistory.data?.rows ?? []).slice(0, 20).map((r) => (
                  <Button variant="ghost"
                    key={r.id}
                    type="button"
                    onClick={() => openHistory(r.key)}
                    className="w-full border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-mono text-[11px] text-zinc-900">{r.key}</div>
                      <div className="shrink-0 text-[11px] text-zinc-500">{new Date(r.changed_at).toLocaleString()}</div>
                    </div>
                    {r.change_reason ? <div className="mt-1 line-clamp-1 text-[11px] text-zinc-600">{r.change_reason}</div> : null}
                  </Button>
                ))}
                {!(qRecentHistory.data?.rows ?? []).length ? (
                  <div className="px-3 py-3 text-sm text-zinc-500">No recent changes.</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Main table */}
          <div className="md:col-span-8">
            {isHome ? (
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Settings home</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Pick a category to browse, or use search &amp; filters to find a specific key.
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCategory("all");
                      navigate("/settings/all");
                    }}
                  >
                    Browse all
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categories
                    .filter((c) => c !== "all")
                    .map((c) => (
                      <Button variant="ghost"
                        key={c}
                        type="button"
                        onClick={() => {
                          setCategory(c);
                          navigate(`/settings/${c}`);
                        }}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left hover:bg-zinc-100"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-zinc-900">{c}</div>
                          <div className="text-xs text-zinc-600">{categoryCounts.get(c) ?? 0}</div>
                        </div>
                        <div className="mt-2 text-xs text-zinc-600">
                          {c === "assistant"
                            ? "Models, tokens, tool policies, orchestrator behavior."
                            : c === "ux"
                              ? "UI copy, presence/seen rules, message UX flags."
                              : c === "ranking"
                                ? "Taste &amp; trending weights, thresholds."
                                : c === "moderation"
                                  ? "Non-secret moderation filters &amp; limits."
                                  : c === "ops"
                                    ? "Timeouts, retries, rate limits, job defaults."
                                    : c === "plan"
                                      ? "Tier caps &amp; quotas."
                                      : c === "integrations"
                                        ? "Non-secret endpoints &amp; integration toggles."
                                        : "Settings in this category."}
                        </div>
                      </Button>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-zinc-600">Reason (optional)</div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you changing these?" />
            </div>

            <div className="space-y-4">
              {keysGrouped.map(([groupName, keys]) => (
                <div key={groupName} className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-600">{groupName}</div>
                  <div className="space-y-2">
                    {keys.map((key) => {
                      const entry = registry[key];
                      const row = rowByKey.get(key);
                      const persisted = Boolean(row);
                      const isRedundantOverride = persisted && deepEqualStable(row?.value, entry.default);
                      const isOverridden = persisted && !isRedundantOverride;
                      const isDirty = Boolean(dirty[key]);
                      const kind = inferKindFromDefault(entry.default);
                      const meta = entry.meta;
                      const hint = getSettingHint(key, { default: entry.default, description: entry.description, meta: entry.meta });
                      const hasCuratedRecommended = hint?.recommended !== undefined;

                      return (
                        <div id={`setting-${key}`} key={key} className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate font-mono text-xs text-zinc-900">{key}</div>
                                <Button variant="ghost"
                                  type="button"
                                  onClick={() => copyKey(key)}
                                  title="Copy key"
                                  aria-label="Copy key"
                                  className="inline-flex h-6 w-6 p-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-[12px] font-semibold text-zinc-500 shadow-sm hover:text-zinc-700"
                                >
                                  ⧉
                                </Button>
                                <Button variant="ghost"
                                  type="button"
                                  onClick={() => toggleFavorite(key)}
                                  title={isFavorite(key) ? "Unfavorite" : "Favorite"}
                                  aria-label={isFavorite(key) ? "Unfavorite" : "Favorite"}
                                  className={cn(
                                    "inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-[12px] font-semibold shadow-sm",
                                    isFavorite(key) ? "text-amber-600" : "text-zinc-400 hover:text-zinc-600",
                                  )}
                                >
                                  ★
                                </Button>
                                <HintIcon onClick={() => openDetails(key)} title="Explain this setting" />
                                <span
                                  className={cn(
                                    "rounded-lg px-2 py-1 text-xs font-semibold",
                                    entry.scope === "public" && "bg-emerald-100 text-emerald-800",
                                    entry.scope === "admin" && "bg-zinc-200 text-zinc-800",
                                    entry.scope === "server_only" && "bg-blue-100 text-blue-800",
                                  )}
                                >
                                  {entry.scope}
                                </span>
                                {!persisted ? (
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">default</span>
                                ) : isOverridden ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">overridden</span>
                                ) : (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-900">redundant</span>
                                )}
                                {isDirty ? <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">modified</span> : null}
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">{entry.description}</div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {persisted ? <span>stored v{row?.version ?? "?"}</span> : <span>using default</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button variant="ghost" onClick={() => resetToDefault(key)}>Reset</Button>
                              <Button variant="ghost" onClick={() => openHistory(key)}>History</Button>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-8">
                              {meta?.kind === "enum" ? (
                                <select
                                  value={draftRaw[key] ?? String(getCurrentValue(key) ?? "")}
                                  onChange={(e) => {
                                    setDraftRaw((prev) => ({ ...prev, [key]: e.target.value }));
                                    markDirty(key);
                                  }}
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                >
                                  {(meta.values ?? []).map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              ) : kind === "boolean" ? (
                                <label className="flex items-center gap-2 text-sm text-zinc-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draftBool[key])}
                                    onChange={(e) => {
                                      setDraftBool((prev) => ({ ...prev, [key]: e.target.checked }));
                                      markDirty(key);
                                    }}
                                  />
                                  {Boolean(draftBool[key]) ? "true" : "false"}
                                </label>
                              ) : kind === "json" ? (
                                <textarea
                                  value={draftRaw[key] ?? ""}
                                  onChange={(e) => {
                                    setDraftRaw((prev) => ({ ...prev, [key]: e.target.value }));
                                    markDirty(key);
                                  }}
                                  rows={6}
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                />
                              ) : kind === "number" ? (
                                <div className="space-y-2">
                                  <Input
                                    value={draftRaw[key] ?? ""}
                                    onChange={(e) => {
                                      setDraftRaw((prev) => ({ ...prev, [key]: e.target.value }));
                                      markDirty(key);
                                    }}
                                    type="number"
                                    min={meta?.kind === "number" ? meta.min : undefined}
                                    max={meta?.kind === "number" ? meta.max : undefined}
                                    step={meta?.kind === "number" && meta.int ? 1 : "any"}
                                  />
                                  {meta?.kind === "number" && typeof meta.min === "number" && typeof meta.max === "number" && (meta.max - meta.min) <= 10000 ? (
                                    <input
                                      type="range"
                                      min={meta.min}
                                      max={meta.max}
                                      step={meta.int ? 1 : 0.1}
                                      value={(() => {
                                        const raw = (draftRaw[key] ?? "").trim();
                                        const parsed = Number(raw);
                                        if (raw !== "" && Number.isFinite(parsed)) return parsed;
                                        const cur = Number(getCurrentValue(key));
                                        if (Number.isFinite(cur)) return cur;
                                        return meta.min;
                                      })()}
                                      onChange={(e) => {
                                        setDraftRaw((prev) => ({ ...prev, [key]: e.target.value }));
                                        markDirty(key);
                                      }}
                                      className="w-full"
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <Input
                                  value={draftRaw[key] ?? ""}
                                  onChange={(e) => {
                                    setDraftRaw((prev) => ({ ...prev, [key]: e.target.value }));
                                    markDirty(key);
                                  }}
                                  type="text"
                                />
                              )}

                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                                <div>
                                  Default: <span className="font-mono">{kind === "json" ? "(json)" : String(entry.default)}</span>
                                  {meta?.kind === "number" && (typeof meta.min === "number" || typeof meta.max === "number") ? (
                                    <span className="ml-2">Range: <span className="font-mono">{meta.min ?? "-∞"}…{meta.max ?? "∞"}</span></span>
                                  ) : null}
                                </div>
                                {hasCuratedRecommended ? (
                                  <Button variant="ghost"
                                    type="button"
                                    onClick={() => applyRecommended(key)}
                                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                                  >
                                    Apply recommended
                                  </Button>
                                ) : null}
                              </div>

                              {kind === "json" ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      try {
                                        const obj = JSON.parse((draftRaw[key] ?? "").trim());
                                        setDraftRaw((prev) => ({ ...prev, [key]: prettyJson(obj) }));
                                        markDirty(key);
                                        toast.push({ variant: "success", title: "Formatted", message: "JSON formatted." });
                                      } catch (e: any) {
                                        toast.push({ variant: "error", title: "Invalid JSON", message: formatAdminError(e) });
                                      }
                                    }}
                                  >
                                    Format JSON
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      try {
                                        JSON.parse((draftRaw[key] ?? "").trim());
                                        toast.push({ variant: "success", title: "Valid", message: "JSON is valid." });
                                      } catch (e: any) {
                                        toast.push({ variant: "error", title: "Invalid JSON", message: formatAdminError(e) });
                                      }
                                    }}
                                  >
                                    Validate
                                  </Button>
                                </div>
                              ) : null}
                            </div>

                            <div className="lg:col-span-4">
                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                <div className="text-xs font-semibold text-zinc-700">Suggested</div>
                                <div className="mt-1 text-xs text-zinc-600">
                                  {hasCuratedRecommended ? (hint?.recommended_why ?? "Curated recommended value.") : "Default value (matches current app behavior)."}
                                </div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 text-xs">{prettyJson(hasCuratedRecommended ? hint?.recommended : entry.default)}</pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!keysFiltered.length ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No matching settings.</div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Modal
        open={paletteOpen}
        title="Jump to setting"
        onClose={() => {
          setPaletteOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Search by key, title, hint text, examples…</div>
            <input
              ref={paletteInputRef}
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setPaletteOpen(false);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = paletteResults[0]?.key;
                  if (first) {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                    jumpToKey(first, { openDetails: true });
                  }
                }
              }}
              placeholder="e.g., ux.presence, tokens, rate limits…"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-xl border border-zinc-200">
            {paletteResults.length ? (
              <div className="divide-y divide-zinc-100">
                {paletteResults.map((r) => {
                  const entry = registry[r.key];
                  const row = rowByKey.get(r.key);
                  const status = !row ? "default" : deepEqualStable(row.value, entry?.default) ? "redundant" : "overridden";
                  return (
                    <Button variant="ghost"
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setPaletteOpen(false);
                        setPaletteQuery("");
                        jumpToKey(r.key, { openDetails: true });
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-zinc-900">{r.key}</div>
                          <div className="mt-1 line-clamp-1 text-xs text-zinc-600">{r.title}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">{topCategoryKey(r.key)}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              status === "default" && "bg-zinc-100 text-zinc-700",
                              status === "overridden" && "bg-amber-100 text-amber-900",
                              status === "redundant" && "bg-purple-100 text-purple-900",
                            )}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                      {r.description ? <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{r.description}</div> : null}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-zinc-500">No matching settings.</div>
            )}
          </div>

          <div className="text-[11px] text-zinc-500">
            Tip: press <span className="font-mono">Enter</span> to jump to the top result. Each result opens the details drawer.
          </div>
        </div>
      </Modal>


      <SettingDetailDrawer
        open={detailOpen}
        settingKey={detailKey}
        entry={detailKey ? registry[detailKey] : null}
        row={detailKey ? (rowByKey.get(detailKey) ?? null) : null}
        onNavigateToKey={(key) => jumpToKey(key, { openDetails: true })}
        status={(() => {
          if (!detailKey) return undefined;
          const entry = registry[detailKey];
          const row = rowByKey.get(detailKey);
          if (!entry) return undefined;
          if (!row) return "default";
          return deepEqualStable(row.value, entry.default) ? "redundant" : "overridden";
        })()}
        hint={detailKey ? getSettingHint(detailKey, registry[detailKey] ? { default: registry[detailKey].default, description: registry[detailKey].description, meta: registry[detailKey].meta } : undefined) : null}
        effectiveValue={detailKey ? getCurrentValue(detailKey) : undefined}
        draftValue={detailKey ? getDrawerDraftValue(detailKey) : undefined}
        recentHistory={qDetailHistory.data?.rows ?? []}
        onClose={closeDetails}
        onCopyKey={detailKey ? (() => copyKey(detailKey)) : undefined}
        onOpenHistory={detailKey ? (() => openHistory(detailKey)) : undefined}
        onApplyValue={detailKey ? ((val) => applyValueToDraft(detailKey, val)) : undefined}
      />







      <Modal
        open={historyOpen}
        title={historyKey ? `History: ${historyKey}` : "History"}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryKey(null);
        }}
      >
        {mutHistory.isPending ? (
          <div className="text-sm text-zinc-500">Loading history…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-600">Range</div>
                <select
                  value={historyDays}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    setHistoryDays(d);
                    if (historyKey) mutHistory.mutate({ key: historyKey, limit: historyLimit, since: historySinceIso(d) });
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  <option value={0}>All</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-600">Limit</div>
                <Input
                  type="number"
                  value={String(historyLimit)}
                  min={1}
                  max={200}
                  onChange={(e) => {
                    const next = clampIntInput(e.target.value, 1, 200, 50);
                    setHistoryLimit(next);
                    if (historyKey) mutHistory.mutate({ key: historyKey, limit: next, since: historySinceIso(historyDays) });
                  }}
                />
              </div>
              <div className="ml-auto flex gap-2">
                <div className="flex rounded-xl border border-zinc-200 bg-white p-1">
                  {[
                    { value: "side_by_side", label: "Side-by-side" },
                    { value: "diff", label: "Diff" },
                  ].map((o) => (
                    <Button variant="ghost"
                      key={o.value}
                      type="button"
                      onClick={() => setHistoryView(o.value as any)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[11px] font-semibold transition",
                        historyView === o.value ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50",
                      )}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>

                <Button variant="ghost" onClick={refreshHistory}>
                  Refresh
                </Button>
              </div>
            </div>

            {historyRows.length ? (
              <div className="space-y-2">
                {historyRows.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-zinc-600">
                        <span className="font-mono">v{r.old_version ?? "—"} → v{r.new_version ?? "—"}</span>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{new Date(r.changed_at).toLocaleString()}</span>
                      </div>
                      {r.change_reason ? (
                        <div className="text-xs text-zinc-600">Reason: {r.change_reason}</div>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-zinc-500">
                        Changed by: <span className="font-mono">{r.changed_by ?? "—"}</span>
                        {r.request_id ? (
                          <>
                            <span className="mx-2">·</span>
                            Req: <span className="font-mono">{r.request_id}</span>
                          </>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => openRollback(r)}>
                          Rollback
                        </Button>
                      </div>
                    </div>
                    {historyView === "diff" ? (

                      <div className="mt-2">

                        <JsonDiff before={r.old_value} after={r.new_value} />

                      </div>

                    ) : (

                      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">

                        <div>

                          <div className="mb-1 text-xs font-semibold text-zinc-700">Old</div>

                          <pre className="max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 text-xs">{prettyJson(r.old_value)}</pre>

                        </div>

                        <div>

                          <div className="mb-1 text-xs font-semibold text-zinc-700">New</div>

                          <pre className="max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 text-xs">{prettyJson(r.new_value)}</pre>

                        </div>

                      </div>

                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No history yet.</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={rollbackOpen}
        title={rollbackRow ? `Rollback: ${rollbackRow.key}` : "Rollback"}
        onClose={() => {
          if (mutRollback.isPending) return;
          setRollbackOpen(false);
          setRollbackRow(null);
          setRollbackReason("");
        }}
      >
        {rollbackRow ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This will write a new settings update that restores the old value from version <span className="font-mono">v{rollbackRow.old_version ?? "—"}</span>.
              The change is audited and can be rolled back again.
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Reason (required)</div>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                rows={3}
                placeholder="Example: Accidentally set too low; restoring previous safe value."
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Will restore</div>
                <pre className="max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs">{prettyJson(rollbackRow.old_value ?? (historyKey ? registry[historyKey]?.default : null) ?? null)}</pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Current (from history row)</div>
                <pre className="max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs">{prettyJson(rollbackRow.new_value)}</pre>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setRollbackOpen(false);
                  setRollbackRow(null);
                  setRollbackReason("");
                }}
                disabled={mutRollback.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => mutRollback.mutate()}
                disabled={mutRollback.isPending || rollbackReason.trim().length < 3}
              >
                {mutRollback.isPending ? "Rolling back…" : "Confirm rollback"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">No rollback target selected.</div>
        )}
      </Modal>
    </div>
  );
}