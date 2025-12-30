import React from "react";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * HighlightText
 *
 * Small UI helper to visually highlight case-insensitive substring matches.
 * Safe (no dangerouslySetInnerHTML) and fast enough for list rendering.
 */
export const HighlightText: React.FC<{
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
  /** If true, highlight only the first match. */
  firstOnly?: boolean;
}> = ({ text, query, className, highlightClassName, firstOnly = false }) => {
  const q = (query ?? "").trim();
  if (!q) return <span className={className}>{text}</span>;

  const parts = React.useMemo(() => {
    const escaped = escapeRegExp(q);
    const re = new RegExp(escaped, "ig");
    const out: Array<{ chunk: string; hit: boolean }> = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let hitCount = 0;

    // eslint-disable-next-line no-cond-assign
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        out.push({ chunk: text.slice(lastIndex, match.index), hit: false });
      }

      const m = match[0];
      out.push({ chunk: m, hit: true });
      lastIndex = match.index + m.length;
      hitCount += 1;

      if (firstOnly && hitCount >= 1) break;
      if (m.length === 0) break; // safety
    }

    if (lastIndex < text.length) {
      out.push({ chunk: text.slice(lastIndex), hit: false });
    }

    return out.length ? out : [{ chunk: text, hit: false }];
  }, [q, text, firstOnly]);

  const hl =
    highlightClassName ??
    "rounded bg-primary/20 px-0.5 text-foreground ring-1 ring-primary/20";

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.hit ? (
          <span key={i} className={hl}>
            {p.chunk}
          </span>
        ) : (
          <React.Fragment key={i}>{p.chunk}</React.Fragment>
        ),
      )}
    </span>
  );
};
