import { useState, useCallback } from 'react';

/**
 * Hook for optimistic UI updates
 * Updates UI immediately, then reverts on error
 * 
 * @example
 * const { optimisticData, updateOptimistically } = useOptimisticUpdate(initialData);
 * 
 * await updateOptimistically(
 *   newData,
 *   async () => await api.update(newData)
 * );
 */
export function useOptimisticUpdate<T>(initialData: T) {
    const [data, setData] = useState<T>(initialData);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateOptimistically = useCallback(
        async (optimisticValue: T, updateFn: () => Promise<T>) => {
            const previousValue = data;

            // Immediately update UI
            setData(optimisticValue);
            setIsUpdating(true);
            setError(null);

            try {
                // Perform actual update
                const result = await updateFn();
                setData(result);
                return result;
            } catch (err) {
                // Revert on error
                setData(previousValue);
                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                throw error;
            } finally {
                setIsUpdating(false);
            }
        },
        [data]
    );

    return {
        data,
        isUpdating,
        error,
        updateOptimistically,
        setData,
    };
}
