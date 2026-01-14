export const getLocalAttemptKey = (topicId: string, sectionType: string, quizId: string) => 
    `inProgress-${topicId}-${sectionType}-${quizId}`;

export const getResultsKey = (topicId: string, sectionType: string, quizId: string) => 
    `quizResults-${topicId}-${sectionType}-${quizId}`;

/**
 * Saves data to LocalStorage, ensuring Sets are serialized to Arrays.
 */
export const saveToLocalStorage = (key: string, data: any) => {
    try {
        const serializedData = { ...data };
        if (serializedData.crossedOffOptions) {
            serializedData.crossedOffOptions = Object.fromEntries(
                Object.entries(serializedData.crossedOffOptions).map(([k, v]) => [k, Array.from(v as Set<string>)])
            );
        }
        localStorage.setItem(key, JSON.stringify(serializedData));
    } catch (e) {
        console.error("Error saving to localStorage", e);
    }
};

/**
 * Loads data from LocalStorage, ensuring Arrays are deserialized back to Sets.
 */
export const loadFromLocalStorage = (key: string) => {
    try {
        const data = localStorage.getItem(key);
        const parsedData = data ? JSON.parse(data) : null;
        
        if (parsedData && parsedData.crossedOffOptions) {
            parsedData.crossedOffOptions = Object.fromEntries(
                Object.entries(parsedData.crossedOffOptions).map(([k, v]) => [k, new Set(v as string[])])
            );
        }
        return parsedData;
    } catch (e) {
        console.error("Error loading from localStorage", e);
        return null;
    }
};

export const clearLocalStorage = (key: string) => localStorage.removeItem(key);

/**
 * Helper to prepare attempt data for API transmission (Sets -> Arrays)
 */
export const serializeAttemptForApi = (attempt: any) => {
    const serializable = { ...attempt };
    if (serializable.crossedOffOptions) {
        serializable.crossedOffOptions = Object.fromEntries(
            Object.entries(serializable.crossedOffOptions).map(([key, value]) => [key, Array.from(value as Set<string>)])
        );
    }
    return serializable;
};