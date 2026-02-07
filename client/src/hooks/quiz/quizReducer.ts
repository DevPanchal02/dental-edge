import { SectionType } from '../../types/content.types';
import { QuizState, QuizAction, QuizAttemptAction, QuizUIAction } from '../../types/quiz.reducer.types';
import { QuizAttemptState } from '../../types/quiz.types';
import { attemptReducer } from './reducers/attemptReducer';
import { uiReducer } from './reducers/uiReducer';

// --- INITIALIZATION HELPERS ---

/**
 * Generates a fresh attempt state object.
 * Used during initialization and reset workflows.
 */
export const createInitialAttempt = (
    topicId: string = '', 
    sectionType: SectionType = 'practice', 
    quizId: string = ''
): QuizAttemptState => ({
    id: null,
    topicId,
    sectionType,
    quizId,
    userAnswers: {},
    markedQuestions: {},
    crossedOffOptions: {}, 
    userTimeSpent: {},
    currentQuestionIndex: 0,
    status: 'initializing',
    highlightedHtml: {},
    practiceTestSettings: { prometricDelay: false, additionalTime: false },
    submittedAnswers: {},
    // Timer is managed via root snapshot, but we initialize defaults here for consistency
    timer: { value: 0, isCountdown: false, initialDuration: 0 }
});

export const initialState: QuizState = {
    status: 'initializing',
    quizIdentifiers: null,
    quizContent: { metadata: null, questions: [] },
    attempt: createInitialAttempt(),
    timerSnapshot: { value: 0, isCountdown: false, initialDuration: 0 },
    uiState: {
        showExplanation: {},
        tempReveal: {},
        isExhibitVisible: false,
        isSaving: false,
        isNavActionInProgress: false
    },
    error: null,
};

// --- ROOT REDUCER ---

/**
 * The Root Reducer for the Quiz Engine.
 * 
 * Responsibilities:
 * 1. Manages Global Lifecycle (Status transitions, Data loading).
 * 2. Manages State Replacement (Resetting attempts, Loading new data).
 * 3. Delegates granular updates to sub-reducers (Attempt, UI).
 */
export function quizReducer(state: QuizState, action: QuizAction): QuizState {
    
    // --- Phase 1: Handle Lifecycle & Root State Changes ---
    // These actions typically affect 'status', 'quizContent', or replace 'attempt' entirely.

    switch (action.type) {
        case 'INITIALIZE_ATTEMPT':
            return {
                ...initialState,
                status: 'loading',
                quizIdentifiers: action.payload,
            };

        case 'PROMPT_OPTIONS':
            return {
                ...state,
                status: 'prompting_options',
                quizContent: {
                    questions: action.payload.questions,
                    metadata: action.payload.metadata,
                },
            };

        case 'START_PREVIEW':
            return {
                ...state,
                status: 'active',
                attempt: {
                    ...state.attempt,
                    id: `preview-${Date.now()}`,
                    practiceTestSettings: action.payload.settings,
                },
                timerSnapshot: {
                    value: action.payload.duration,
                    isCountdown: true,
                    initialDuration: action.payload.duration,
                }
            };

        case 'PROMPT_REGISTRATION':
            return {
                ...state,
                status: 'prompting_registration',
            };

        case 'CLOSE_REGISTRATION_PROMPT':
             return {
                ...state,
                status: 'active',
             };

        case 'PROMPT_RESUME': {
            const loadedTimer = action.payload.attempt.timer || initialState.timerSnapshot;
            return {
                ...state,
                status: 'prompting_resume',
                attempt: {
                    ...state.attempt, 
                    ...action.payload.attempt,
                    highlightedHtml: action.payload.attempt.highlightedHtml || {},
                },
                timerSnapshot: {
                    value: loadedTimer.value,
                    isCountdown: loadedTimer.isCountdown,
                    initialDuration: loadedTimer.initialDuration
                },
                quizContent: {
                    questions: action.payload.questions,
                    metadata: action.payload.metadata,
                },
            };
        }

        case 'SET_DATA_AND_START': {
            const startTimerValue = action.payload.initialDuration || 0;
            const isCountdown = startTimerValue > 0;

            return {
                ...state,
                status: 'active',
                quizContent: {
                    ...state.quizContent,
                    questions: action.payload.questions,
                    metadata: action.payload.metadata,
                },
                // Full replacement of the attempt slice
                attempt: {
                    ...initialState.attempt,
                    id: action.payload.attemptId,
                    topicId: state.quizIdentifiers?.topicId || '',
                    sectionType: state.quizIdentifiers?.sectionType || 'practice',
                    quizId: state.quizIdentifiers?.quizId || '',
                    practiceTestSettings: action.payload.settings || { prometricDelay: false, additionalTime: false },
                },
                timerSnapshot: { 
                    value: startTimerValue, 
                    isCountdown, 
                    initialDuration: startTimerValue 
                }
            };
        }

        case 'RESUME_ATTEMPT':
            return {
                ...state,
                status: state.quizIdentifiers?.reviewAttemptId ? 'reviewing_attempt' : 'active',
            };

        case 'RESET_ATTEMPT':
            return {
                ...state,
                status: 'active',
                // Full replacement of the attempt slice
                attempt: {
                    ...initialState.attempt,
                    id: action.payload.newAttemptId,
                    topicId: state.quizIdentifiers?.topicId || '',
                    sectionType: state.quizIdentifiers?.sectionType || 'practice',
                    quizId: state.quizIdentifiers?.quizId || '',
                },
                timerSnapshot: { ...initialState.timerSnapshot }
            };
            
        case 'SYNC_TIMER_SNAPSHOT':
            return {
                ...state,
                timerSnapshot: {
                    ...state.timerSnapshot,
                    value: action.payload.value
                }
            };

        case 'FINALIZE_SUCCESS':
            return { 
                ...state, 
                status: 'completed', 
                attempt: { ...state.attempt, id: action.payload.attemptId }
            };

        case 'SET_ERROR': {
            const normalizedError = action.payload instanceof Error 
                ? action.payload 
                : typeof action.payload === 'string'
                    ? new Error(action.payload)
                    : new Error(String(action.payload) || 'An unknown error occurred');

            return { ...state, status: 'error', error: normalizedError };
        }

        case 'OPEN_REVIEW_SUMMARY':
            return { ...state, status: 'reviewing_summary' };
        
        case 'CLOSE_REVIEW_SUMMARY':
            return { ...state, status: 'active' };

        // --- Phase 2: Delegate to Sub-Reducers ---
        default:
            return {
                ...state,
                attempt: attemptReducer(state.attempt, action as QuizAttemptAction),
                uiState: uiReducer(state.uiState, action as QuizUIAction, state.attempt.currentQuestionIndex)
            };
    }
}