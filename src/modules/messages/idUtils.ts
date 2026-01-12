export const TEMP_ID_PREFIX = "temp-" as const;

export const isTempId = (id: string): boolean => id.startsWith(TEMP_ID_PREFIX);

export const ensureTempId = (id: string): string => (isTempId(id) ? id : `${TEMP_ID_PREFIX}${id}`);

/** Preserves the historical format used in some optimistic updates: `temp-<timestampMs>` */
export const createTimestampTempId = (timestampMs: number = Date.now()): string =>
  `${TEMP_ID_PREFIX}${timestampMs}`;

/** Default format for optimistic messages: `temp-<timestampMs>-<random>` */
export const createRandomTempId = (timestampMs: number = Date.now()): string =>
  `${TEMP_ID_PREFIX}${timestampMs}-${Math.random().toString(36).slice(2, 8)}`;

export type NormalizeIdListOptions = {
  /** Trim, drop empty strings, and de-duplicate */
  dedupe?: boolean;
  /** Exclude optimistic temp IDs */
  excludeTemp?: boolean;
  /** Sort lexicographically after normalization */
  sort?: boolean;
};

/**
 * Normalizes an id list by trimming, removing empties, and optionally de-duplicating / sorting.
 * Kept generic (not messages-specific) to reuse for message ids, receipt ids, etc.
 */
export const normalizeIdList = (
  ids: Array<string | null | undefined>,
  options: NormalizeIdListOptions = {},
): string[] => {
  const { dedupe = true, excludeTemp = false, sort = false } = options;

  const trimmed = ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id) => (excludeTemp ? !isTempId(id) : true));

  const unique = dedupe ? Array.from(new Set(trimmed)) : trimmed;
  if (sort) unique.sort();
  return unique;
};
