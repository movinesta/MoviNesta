import React from "react";

// Very small linkifier for chat.
// - Handles http(s):// and www.
// - Handles emails (mailto:)
// - Handles phone-ish numbers (tel:), conservatively.
// Keeps rendering cheap (no heavy dep) and safe (no innerHTML).

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;
const EMAIL_REGEX = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
// Very permissive, then we validate digit count >= 10.
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;

const normalizeUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return value;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const normalizeTel = (value: string) => {
  // Keep a single leading +, strip everything else.
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = digitsOnly(trimmed);
  return `${hasPlus ? "+" : ""}${digits}`;
};

type LinkifiedTextProps = {
  text: string;
  /** Optional highlight query (case-insensitive). Used by in-conversation search. */
  highlight?: string;
};

function splitWithHighlight(input: string, query: string) {
  const q = query.trim();
  if (!q) return [{ text: input, match: false }];

  const lower = input.toLowerCase();
  const qLower = q.toLowerCase();
  const out: { text: string; match: boolean }[] = [];

  let i = 0;
  while (i < input.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx < 0) {
      out.push({ text: input.slice(i), match: false });
      break;
    }
    if (idx > i) out.push({ text: input.slice(i, idx), match: false });
    out.push({ text: input.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }

  return out.length ? out : [{ text: input, match: false }];
}

function renderHighlightedText(text: string, highlight: string | undefined) {
  const h = (highlight ?? "").trim();
  if (!h) return text;

  return splitWithHighlight(text, h).map((part, idx) =>
    part.match ? (
      <mark
        key={`${idx}-${part.text}`}
        className="rounded bg-primary/20 px-0.5 text-foreground"
      >
        {part.text}
      </mark>
    ) : (
      <React.Fragment key={`${idx}-${part.text}`}>{part.text}</React.Fragment>
    ),
  );
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, highlight }) => {
  // If LinkifiedText is rendered inside a clickable message bubble, ensure
  // link interactions don't also trigger the bubble's click handler.
  const stopBubbleToggle = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  // Collect all matches (URLs/emails/phones), then render in-order.
  // If matches overlap, prefer earlier match and skip overlaps.
  const matches: { start: number; end: number; kind: "url" | "email" | "phone"; raw: string }[] =
    [];

  const pushMatches = (regex: RegExp, kind: "url" | "email" | "phone") => {
    const r = new RegExp(regex);
    let m: RegExpExecArray | null;

    while ((m = r.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, kind, raw: m[0] });
    }
  };

  pushMatches(URL_REGEX, "url");
  pushMatches(EMAIL_REGEX, "email");
  pushMatches(PHONE_REGEX, "phone");

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue; // overlap

    // Validate phone numbers: must have enough digits.
    if (match.kind === "phone") {
      const digits = digitsOnly(match.raw);
      if (digits.length < 10) continue;
    }

    if (match.start > cursor) {
      const raw = text.slice(cursor, match.start);
      parts.push(renderHighlightedText(raw, highlight));
    }

    if (match.kind === "url") {
      const href = normalizeUrl(match.raw);
      parts.push(
        <a
          key={`${match.start}-${match.raw}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
          onMouseDown={stopBubbleToggle}
          onClick={stopBubbleToggle}
          onTouchStart={stopBubbleToggle}
        >
          {renderHighlightedText(match.raw, highlight)}
        </a>,
      );
    } else if (match.kind === "email") {
      parts.push(
        <a
          key={`${match.start}-${match.raw}`}
          href={`mailto:${match.raw}`}
          className="underline underline-offset-2"
          onMouseDown={stopBubbleToggle}
          onClick={stopBubbleToggle}
          onTouchStart={stopBubbleToggle}
        >
          {renderHighlightedText(match.raw, highlight)}
        </a>,
      );
    } else {
      const tel = normalizeTel(match.raw);
      parts.push(
        <a
          key={`${match.start}-${match.raw}`}
          href={`tel:${tel}`}
          className="underline underline-offset-2"
          onMouseDown={stopBubbleToggle}
          onClick={stopBubbleToggle}
          onTouchStart={stopBubbleToggle}
        >
          {renderHighlightedText(match.raw, highlight)}
        </a>,
      );
    }

    cursor = match.end;
  }

  if (cursor < text.length) {
    parts.push(renderHighlightedText(text.slice(cursor), highlight));
  }

  return <>{parts}</>;
};

export default LinkifiedText;
