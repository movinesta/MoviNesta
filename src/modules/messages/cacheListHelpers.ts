export type ListKeyFn<T> = (item: T) => string;

export type ListSortFn<T> = (a: T, b: T) => number;

type UpsertOptions<T> = {
  key: ListKeyFn<T>;
  sort?: ListSortFn<T>;
};

/**
 * Upsert an item into an array by key, optionally sorting the result.
 * Designed for React Query cache updates where "existing" can be undefined.
 */
export const upsertIntoList = <T>(existing: readonly T[] | undefined, item: T, opts: UpsertOptions<T>): T[] => {
  const current = (existing ?? []) as readonly T[];
  const k = opts.key(item);

  const next = [...current];
  const idx = next.findIndex((x) => opts.key(x) === k);
  if (idx >= 0) next[idx] = item;
  else next.push(item);

  if (opts.sort) next.sort(opts.sort);
  return next;
};

type RemoveOptions<T> = {
  key: ListKeyFn<T>;
};

export const removeFromList = <T>(
  existing: readonly T[] | undefined,
  keyToRemove: string,
  opts: RemoveOptions<T>,
): T[] => {
  const current = (existing ?? []) as readonly T[];
  if (current.length === 0) return [];
  return current.filter((x) => opts.key(x) !== keyToRemove);
};
