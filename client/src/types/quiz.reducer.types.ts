import { 
    Question, 
    QuizMetadata, 
    QuizAttemptState, 
    QuizIdentifiers, 
    QuizStatus, 
    TimerSnapshot,
    PracticeTestSettings
} from './quiz.types';

// --- STATE DEFINITIONS ---

export interface QuizContentState {
    metadata: QuizMetadata | null;
    questions: Question[];
}

export interface QuizUIState {
    showExplanation: Record<number, boolean>;
    tempReveal: Record<number, boolean>;
    isExhibitVisible: boolean;
    isSaving: boolean;
    isNavActionInProgress: boolean;
}

export interface QuizState {
    status: QuizStatus;
    
    // Context
    quizIdentifiers: QuizIdentifiers | null;

    // Content
    quizContent: QuizContentState;

    // User Progress (Business Logic)
    attempt: QuizAttemptState;

    // Persistence (Imported from Domain Types to ensure DB compatibility)
    timerSnapshot: TimerSnapshot;

    // View State
    uiState: QuizUIState;

    error: Error | null;
}

// --- ACTION GROUPINGS ---

/**
 * Actions that modify the User's Attempt (Answers, Marks, Navigation)
 * Handled by: attemptReducer
 */
export type QuizAttemptAction = 
    | { type: 'SELECT_OPTION'; payload: { questionIndex: number; optionLabel: string } }
    | { type: 'TOGGLE_CROSS_OFF'; payload: { questionIndex: number; optionLabel: string } }
    | { type: 'TOGGLE_MARK'; payload: number }
    | { type: 'NAVIGATE_QUESTION'; payload: number }
    | { type: 'SUBMIT_CURRENT_ANSWER' }
    | { type: 'UPDATE_TIME_SPENT'; payload: { questionIndex: number; time: number } }
    | { type: 'UPDATE_HIGHLIGHT'; payload: { contentKey: string; html: string } };

/**
 * Actions that modify the UI (Modals, Toggles, Loading States)
 * Handled by: uiReducer
 */
export type QuizUIAction = 
    | { type: 'TOGGLE_EXHIBIT' }
    | { type: 'TOGGLE_SOLUTION' }
    | { type: 'TOGGLE_EXPLANATION' }
    | { type: 'OPEN_REVIEW_SUMMARY' }
    | { type: 'CLOSE_REVIEW_SUMMARY' }
    | { type: 'SET_IS_SAVING'; payload: boolean };

/**
 * Actions that affect the entire lifecycle or root state
 * Handled by: root quizReducer
 */
export type QuizLifecycleAction =
    | { type: 'INITIALIZE_ATTEMPT'; payload: QuizIdentifiers }
    | { type: 'PROMPT_OPTIONS'; payload: { questions: Question[]; metadata: QuizMetadata } }
    | { type: 'START_PREVIEW'; payload: { settings: { prometricDelay: boolean; additionalTime: boolean }; duration: number } }
    | { type: 'PROMPT_REGISTRATION' }
    | { type: 'CLOSE_REGISTRATION_PROMPT' }
    | { type: 'PROMPT_RESUME'; payload: { attempt: Partial<QuizAttemptState>; questions: Question[]; metadata: QuizMetadata } }
    | { type: 'SET_DATA_AND_START'; payload: { questions: Question[]; metadata: QuizMetadata; attemptId: string; settings?: PracticeTestSettings; initialDuration?: number } }
    | { type: 'RESUME_ATTEMPT' }
    | { type: 'RESET_ATTEMPT'; payload: { newAttemptId: string } }
    | { type: 'FINALIZE_SUCCESS'; payload: { attemptId: string | null } }
    | { type: 'SYNC_TIMER_SNAPSHOT'; payload: { value: number } }
    | { type: 'SET_ERROR'; payload: unknown };

/**
 * The Master Action Union
 */
export type QuizAction = 
    | QuizAttemptAction 
    | QuizUIAction 
    | QuizLifecycleAction;