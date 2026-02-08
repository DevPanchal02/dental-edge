//centralized error handeling file

export const getErrorMessage = (error: unknown, defaultMessage: string = "An unexpected error occurred."): string => {
    // 1. If it's a standard JS Error (or subclass like HttpsError)
    if (error instanceof Error) {
        // Optional: Strip common Firebase prefixes if desired
        return error.message.replace("Firebase: ", "").trim();
    }

    // 2. If it's a raw string throw
    if (typeof error === 'string') {
        return error;
    }

    // 3. If it's an object with a 'message' property (common in API JSON responses)
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as Record<string, unknown>).message);
    }

    // 4. Fallback
    return defaultMessage;
};

/**
 * Helper to determine if an error is a specific "Upgrade Required" error.
 * Useful for specific UI flows (like showing the Upgrade Modal).
 */
export const isUpgradeError = (error: unknown): boolean => {
    if (error instanceof Error && 'code' in error) {
        return (error as any).code === 'upgrade_required';
    }
    return false;
};