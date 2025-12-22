import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    isLoading?: boolean;
}

/**
 * Reusable confirmation dialog component
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    isLoading = false,
}) => {
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            console.error('Confirmation action failed:', error);
        } finally {
            setIsConfirming(false);
        }
    };

    const variantStyles = {
        danger: 'text-red-600 dark:text-red-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        default: 'text-blue-600 dark:text-blue-400',
    };

    const buttonVariants = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-yellow-600 hover:bg-yellow-700',
        default: 'bg-blue-600 hover:bg-blue-700',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {variant !== 'default' && (
                            <AlertTriangle className={`h-6 w-6 ${variantStyles[variant]}`} aria-hidden />
                        )}
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        disabled={isConfirming || isLoading}
                    >
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{description}</p>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <Button
                        onClick={onClose}
                        variant="secondary"
                        disabled={isConfirming || isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirming || isLoading}
                        className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]}`}
                    >
                        {isConfirming || isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
