import React, { useMemo, useState } from "react";

export type AssistantAction = {
  id: string;
  label?: string;
  type: string;
  payload?: unknown;
};

export type AssistantUiCard = {
  id: string;
  title?: string;
  subtitle?: string;
  poster?: string | null;
  kind?: string | null;
  year?: number | null;
  reason?: string | null;
  badges?: string[] | null;
  actionIds?: string[] | null;
};

export type AssistantUiPayload = {
  version?: number;
  layout?: "stacked";
  heading?: string;
  subheading?: string;
  cards?: AssistantUiCard[] | null;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function coerceUiPayload(value: unknown): AssistantUiPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as AssistantUiPayload;
}

export default function AssistantMessageUI({
  ui,
  actions,
  onAction,
}: {
  ui: unknown;
  actions: unknown;
  onAction: (actionId: string) => Promise<void> | void;
}) {
  const payload = useMemo(() => coerceUiPayload(ui), [ui]);
  const actionList = useMemo(
    () => (Array.isArray(actions) ? (actions as AssistantAction[]) : []),
    [actions],
  );
  const actionsById = useMemo(() => {
    const map = new Map<string, AssistantAction>();
    for (const a of actionList) {
      if (a && typeof a === "object" && isNonEmptyString((a as any).id)) {
        map.set(String((a as any).id), a as AssistantAction);
      }
    }
    return map;
  }, [actionList]);

  const [pending, setPending] = useState<Record<string, boolean>>({});

  const renderActionButtons = (ids: string[]) => {
    const safeIds = Array.from(new Set(ids.filter(isNonEmptyString))).slice(0, 6);
    if (safeIds.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {safeIds.map((id) => {
          const action = actionsById.get(id);
          if (!action) return null;

          const fallbackLabel = (() => {
            const t = String(action.type ?? "").toLowerCase();
            if (t === "dismiss") return "Dismiss";
            if (t === "navigate") return "Open";
            return "Do";
          })();

          const label = isNonEmptyString(action.label) ? action.label : fallbackLabel;
          const isBusy = Boolean(pending[id]);

          return (
            <button
              key={id}
              type="button"
              onClick={async () => {
                try {
                  setPending((p) => ({ ...p, [id]: true }));
                  await onAction(id);
                } finally {
                  setPending((p) => ({ ...p, [id]: false }));
                }
              }}
              disabled={isBusy}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition " +
                (isBusy
                  ? "bg-muted text-muted-foreground opacity-70"
                  : "bg-primary text-primary-foreground hover:bg-primary/90")
              }
            >
              {isBusy ? "Working…" : label}
            </button>
          );
        })}
      </div>
    );
  };

  // If there's no structured UI but we *do* have actions, still render them.
  if (!payload || (payload.layout ?? "stacked") !== "stacked") {
    const ids = actionList.map((a) => String((a as any)?.id ?? "")).filter(isNonEmptyString);
    if (ids.length === 0) return null;
    return <div className="mt-2">{renderActionButtons(ids)}</div>;
  }

  const cards = Array.isArray(payload.cards) ? payload.cards : [];
  const usedActionIds = new Set<string>();
  for (const c of cards) {
    const ids = (Array.isArray((c as any)?.actionIds) ? (c as any).actionIds : []).filter(
      isNonEmptyString,
    );
    for (const id of ids) usedActionIds.add(String(id));
  }

  const extraActionIds = actionList
    .map((a) => String((a as any)?.id ?? ""))
    .filter((id) => isNonEmptyString(id) && !usedActionIds.has(id));

  // If there are no cards/headings but there are actions, show actions.
  if (!payload.heading && cards.length === 0 && extraActionIds.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {(payload.heading || payload.subheading) && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          {payload.heading ? (
            <div className="text-sm font-semibold text-foreground">{payload.heading}</div>
          ) : null}
          {payload.subheading ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{payload.subheading}</div>
          ) : null}
        </div>
      )}

      {cards.map((card) => {
        const actionIds = (Array.isArray(card.actionIds) ? card.actionIds : []).filter(
          isNonEmptyString,
        );

        return (
          <div key={card.id} className="rounded-2xl border border-border/60 bg-card/60 p-3">
            <div className="flex gap-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                {card.poster ? (
                  <img
                    src={card.poster}
                    alt={card.title ?? ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {card.title ?? ""}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[card.kind, card.year ? String(card.year) : null]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                </div>

                {card.reason ? (
                  <div className="mt-2 text-xs text-muted-foreground">{card.reason}</div>
                ) : null}

                {Array.isArray(card.badges) && card.badges.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {card.badges.slice(0, 6).map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                ) : null}

                {actionIds.length ? (
                  <div className="mt-3">{renderActionButtons(actionIds)}</div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {extraActionIds.length ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
          <div className="text-xs font-semibold text-muted-foreground">Actions</div>
          <div className="mt-2">{renderActionButtons(extraActionIds)}</div>
        </div>
      ) : null}
    </div>
  );
}
