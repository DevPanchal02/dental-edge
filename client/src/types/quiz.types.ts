import { SectionType } from './content.types';

export type HtmlContent = string; // Alias for clarity

export interface QuizMetadata {
    name: string;
    topicName: string;
    fullNameForDisplay: string;
    categoryForInstructions: string;
}

export interface Option {
    label: string;
    html_content: HtmlContent;
    is_correct: boolean;
    percentage_selected?: string; // e.g., "45%"
}

export interface QuestionAnalytics {
    percent_correct: string; // e.g., "65%"
    time_spent?: string;
    category?: string;
}

export interface QuestionPassage {
    html_content: HtmlContent;
    id?: string;
}

export interface Question {
    id?: string | number; // Sometimes IDs are numeric indices in legacy data
    question: {
        html_content: HtmlContent;
    };
    options: Option[];
    explanation: {
        html_content: HtmlContent;
    };
    passage?: QuestionPassage; // Optional: Only for Reading Comp
    analytics?: QuestionAnalytics;
    category?: string; // e.g., "Organic Chemistry"
    correct_answer_original_text?: string;
    error?: string; // For handling loading errors gracefully
}

/**
 * The core state of a user's active quiz session.
 * Used by useQuizEngine and Firestore.
 */
export interface QuizAttempt {
    id: string | null; // Null if not saved to server yet
    topicId: string;
    sectionType: SectionType;
    quizId: string;
    
    // State Maps
    userAnswers: Record<number, string>; // Index -> Option Label (e.g., { 0: 'A' })
    markedQuestions: Record<number, boolean>;
    crossedOffOptions: Record<number, string[]>; // Index -> Array of labels
    userTimeSpent: Record<number, number>; // Index -> Seconds
    
    // Status
    currentQuestionIndex: number;
    status: 'initializing' | 'active' | 'reviewing_summary' | 'completed';
    score?: number;
    
    // Metadata
    createdAt?: number; // Timestamp
    updatedAt?: number;
    
    // UI State embedded in attempt (optional, often kept separate in UI state)
    highlightedHtml?: Record<string, string>; 
    
    // Timer State (embedded for persistence)
    timer: {
        value: number;
        isActive: boolean;
        isCountdown: boolean;
        initialDuration: number;
    };
}