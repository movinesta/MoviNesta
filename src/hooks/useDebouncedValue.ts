import { useEffect, useState } from "react";

/**
 * useDebouncedValue
 *
 * Small utility hook that returns a debounced version of a value.
 * Useful for text inputs that should not trigger a network request on every keystroke.
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debounced;
};
