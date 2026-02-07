import { QuizAttempt, QuizAttemptState } from '../../types/quiz.types';

export const getLocalAttemptKey = (topicId: string, sectionType: string, quizId: string) => 
    `inProgress-${topicId}-${sectionType}-${quizId}`;

export const getResultsKey = (topicId: string, sectionType: string, quizId: string) => 
    `quizResults-${topicId}-${sectionType}-${quizId}`;

/**
 * Saves data to LocalStorage.
 * Accepts Generic <T> but uses type narrowing to handle Set serialization safely.
 */
export const saveToLocalStorage = <T>(key: string, data: T): void => {
    try {
        // We do a shallow copy to avoid mutating the original object
        // We cast to 'Record<string, unknown>' to inspect properties safely
        const serializedData = { ...data } as Record<string, unknown>;
        
        // If we detect the specific 'crossedOffOptions' property from our State interface
        if (serializedData.crossedOffOptions && typeof serializedData.crossedOffOptions === 'object') {
            const crossedOff = serializedData.crossedOffOptions as Record<number, unknown>;
            
            serializedData.crossedOffOptions = Object.fromEntries(
                Object.entries(crossedOff).map(([k, v]) => {
                    // Check if v is a Set before converting. 
                    // This makes the util safe for both QuizAttempt (Array) and QuizAttemptState (Set)
                    return [k, v instanceof Set ? Array.from(v) : v];
                })
            );
        }
        localStorage.setItem(key, JSON.stringify(serializedData));
    } catch (e) {
        console.error("Error saving to localStorage", e);
    }
};

/**
 * Loads data from LocalStorage.
 */
export const loadFromLocalStorage = <T>(key: string): T | null => {
    try {
        const data = localStorage.getItem(key);
        if (!data) return null;

        const parsedData = JSON.parse(data);
        
        // Rehydrate Arrays back to Sets if this is being loaded into a structure that expects them
        // Note: We check if the target type T likely expects Sets by simple property inspection
        if (parsedData && parsedData.crossedOffOptions) {
            parsedData.crossedOffOptions = Object.fromEntries(
                Object.entries(parsedData.crossedOffOptions).map(([k, v]) => [k, new Set(v as string[])])
            );
        }
        return parsedData as T;
    } catch (e) {
        console.error("Error loading from localStorage", e);
        return null;
    }
};

export const clearLocalStorage = (key: string): void => localStorage.removeItem(key);

//STRICT BRIDGE FUNCTION: Converts Reducer State (Sets) -> API Data (Arrays).
export const serializeAttemptForApi = (attempt: QuizAttemptState): QuizAttempt => {
    const { crossedOffOptions, ...rest } = attempt;
    
    // Explicitly map Record<number, Set<string>> -> Record<number, string[]>
    const serializedCrossedOff: Record<number, string[]> = Object.fromEntries(
        Object.entries(crossedOffOptions).map(([key, value]) => {
            return [key, Array.from(value)];
        })
    );
    
    return {
        ...rest,
        crossedOffOptions: serializedCrossedOff
    };
};