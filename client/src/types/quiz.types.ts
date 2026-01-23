import { SectionType } from './content.types';

/**
 * Alias for strings containing HTML markup to be rendered safely.
 */
export type HtmlContent = string;

/**
 * Metadata describing the context and display properties of a quiz.
 */
export interface QuizMetadata {
    name: string;
    topicName: string;
    fullNameForDisplay: string;
    categoryForInstructions: string;
}

/**
 * Represents a single answer option within a question.
 */
export interface Option {
    label: string;
    html_content: HtmlContent;
    is_correct: boolean;
    /** Statistical percentage of users who selected this option (e.g., "45%"). */
    percentage_selected?: string;
}

/**
 * Analytics data associated with a specific question.
 */
export interface QuestionAnalytics {
    /** Formatted percentage string (e.g., "65%"). */
    percent_correct: string;
    time_spent?: string;
    category?: string;
}

/**
 * Represents a reading passage associated with a question.
 */
export interface QuestionPassage {
    html_content: HtmlContent;
    id?: string;
}

/**
 * Structure of a single question entity as consumed by the application.
 */
export interface Question {
    /** Unique identifier or numeric index from legacy data sources. */
    id?: string | number;
    question: {
        html_content: HtmlContent;
    };
    options: Option[];
    explanation: {
        html_content: HtmlContent;
    };
    /** Optional reading passage (e.g., for Reading Comprehension sections). */
    passage?: QuestionPassage;
    analytics?: QuestionAnalytics;
    category?: string;
    correct_answer_original_text?: string;
    /** Error message populated if data loading fails for this specific item. */
    error?: string;
}

/**
 * Represents the persistent state of a user's quiz session.
 * This structure is serialized to Firestore and LocalStorage.
 */
export interface QuizAttempt {
    /** Unique identifier for the attempt (null if not yet persisted to server). */
    id: string | null;
    topicId: string;
    sectionType: SectionType;
    quizId: string;

    // --- State Maps ---

    /** Map of question index to selected option label (e.g., { 0: 'A' }). */
    userAnswers: Record<number, string>;
    
    /** Map of question index to flagged status. */
    markedQuestions: Record<number, boolean>;
    
    /** 
     * Map of question index to array of crossed-off option labels. 
     * Stored as array for JSON serialization; converted to Set in UI state.
     */
    crossedOffOptions: Record<number, string[]>;
    
    /** Map of question index to time spent in seconds. */
    userTimeSpent: Record<number, number>;

    /** 
     * Tracks questions that have been officially submitted/graded.
     * Used primarily for "Show Solution" or immediate feedback modes.
     */
    submittedAnswers?: Record<number, boolean>;

    /** Configuration settings specific to Practice Tests. */
    practiceTestSettings?: {
        prometricDelay: boolean;
        additionalTime: boolean;
    };

    // --- Status & Metadata ---

    currentQuestionIndex: number;
    status: 'initializing' | 'active' | 'reviewing_summary' | 'completed';
    score?: number;
    
    /** Timestamp (ms) of creation. */
    createdAt?: number;
    /** Timestamp (ms) of last update. */
    updatedAt?: number;
    /** Timestamp (ms) of completion (Present on completed attempts). */
    completedAt?: number;
    
    /** 
     * User-generated highlights mapped by content key.
     * Embedded here to ensure persistence across sessions.
     */
    highlightedHtml?: Record<string, string>; 
    
    /** Snapshot of the timer state for persistence. */
    timer: {
        value: number;
        // REMOVED: isActive is a runtime state, not a persistence state.
        isCountdown: boolean;
        initialDuration: number;
    };
}

/**
 * The "Internal/Runtime" shape (Sets).
 * Used for React State and Hooks for performance (O(1) lookups).
 */
export interface QuizAttemptState extends Omit<QuizAttempt, 'crossedOffOptions'> {
    crossedOffOptions: Record<number, Set<string>>;
}

/**
 * Represents the final summary object stored in LocalStorage after a quiz is completed.
 */
export interface QuizResult {
    score: number;
    totalQuestions: number;
    totalValidQuestions: number;
    userAnswers: Record<number, string>;
    timestamp: number;
    quizName?: string;
    correctIndices: number[];
    incorrectIndices: number[];
}