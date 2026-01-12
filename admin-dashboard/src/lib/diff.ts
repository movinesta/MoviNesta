export type DiffOp = { type: "equal" | "add" | "del"; line: string };

/**
 * Very small line-based diff (LCS) for admin UI previews.
 * - Intended for small JSON payloads (settings values).
 * - Caps input lines to avoid O(n*m) blowups.
 */
export function diffLines(before: string, after: string, opts?: { maxLines?: number }): DiffOp[] {
  const max = opts?.maxLines ?? 300;

  const a0 = before.split("\n");
  const b0 = after.split("\n");
  const a = a0.length > max ? [...a0.slice(0, max), `… (truncated ${a0.length - max} lines)`] : a0;
  const b = b0.length > max ? [...b0.slice(0, max), `… (truncated ${b0.length - max} lines)`] : b0;

  const n = a.length;
  const m = b.length;

  // dp[i][j] = length of LCS of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "equal", line: a[i] });
      i++;
      j++;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", line: a[i] });
      i++;
    } else {
      out.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: "del", line: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ type: "add", line: b[j] });
    j++;
  }
  return out;
}
