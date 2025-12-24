import React from 'react';

/**
 * Search results skeleton loader
 */
export const SearchSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse"
                >
                    {/* Poster skeleton */}
                    <div className="flex-shrink-0 w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded" />

                    {/* Content skeleton */}
                    <div className="flex-1 space-y-3">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="flex gap-2">
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

/**
 * Card grid skeleton loader
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="space-y-2 animate-pulse">
                    <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
            ))}
        </div>
    );
};

/**
 * Profile skeleton loader
 */
export const ProfileSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex-1 space-y-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1">
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
            </div>
        </div>
    );
};
