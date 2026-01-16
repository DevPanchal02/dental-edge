import { SectionType } from '../../types/content.types';
import { Question, QuizMetadata, QuizAttemptState } from '../../types/quiz.types';

// --- STATE DEFINITIONS ---

export interface QuizState {
    status: 'initializing' | 'loading' | 'prompting_options' | 'prompting_registration' | 'prompting_resume' | 'active' | 'reviewing_summary' | 'completed' | 'error' | 'reviewing_attempt';
    
    // Identifiers for the current quiz context
    quizIdentifiers: {
        topicId: string;
        sectionType: SectionType;
        quizId: string;
        reviewAttemptId?: string | null;
        isPreviewMode: boolean;
    } | null;

    // Static content loaded from the server
    quizContent: {
        metadata: QuizMetadata | null;
        questions: Question[];
    };

    // Dynamic user progress (uses Sets for O(1) lookup performance)
    attempt: QuizAttemptState;

    timer: {
        value: number;
        isActive: boolean;
        isCountdown: boolean;
        initialDuration: number;
    };

    // Ephemeral UI state (not persisted to DB)
    uiState: {
        showExplanation: Record<number, boolean>;
        tempReveal: Record<number, boolean>;
        isExhibitVisible: boolean;
        isSaving: boolean;
        isNavActionInProgress?: boolean; 
    };

    error: Error | null;
}

// --- ACTION TYPES ---

export type QuizAction =
    | { type: 'INITIALIZE_ATTEMPT'; payload: NonNullable<QuizState['quizIdentifiers']> }
    | { type: 'PROMPT_OPTIONS'; payload: { questions: Question[]; metadata: QuizMetadata } }
    | { type: 'START_PREVIEW'; payload: { settings: { prometricDelay: boolean; additionalTime: boolean }; duration: number } }
    | { type: 'PROMPT_REGISTRATION' }
    | { type: 'CLOSE_REGISTRATION_PROMPT' }
    | { type: 'PROMPT_RESUME'; payload: { attempt: any; questions: Question[]; metadata: QuizMetadata } }
    | { type: 'SET_DATA_AND_START'; payload: { questions: Question[]; metadata: QuizMetadata; attemptId: string; settings?: { prometricDelay: boolean; additionalTime: boolean }; initialDuration?: number } }
    | { type: 'RESUME_ATTEMPT' }
    | { type: 'RESET_ATTEMPT'; payload: { newAttemptId: string } }
    | { type: 'TIMER_TICK' }
    | { type: 'STOP_TIMER' }
    | { type: 'SUBMIT_CURRENT_ANSWER' }
    | { type: 'UPDATE_TIME_SPENT'; payload: { questionIndex: number; time: number } }
    | { type: 'SELECT_OPTION'; payload: { questionIndex: number; optionLabel: string } }
    | { type: 'TOGGLE_CROSS_OFF'; payload: { questionIndex: number; optionLabel: string } }
    | { type: 'NAVIGATE_QUESTION'; payload: number }
    | { type: 'TOGGLE_MARK'; payload: number }
    | { type: 'TOGGLE_EXHIBIT' }
    | { type: 'TOGGLE_SOLUTION' }
    | { type: 'TOGGLE_EXPLANATION' }
    | { type: 'UPDATE_HIGHLIGHT'; payload: { contentKey: string; html: string } }
    | { type: 'OPEN_REVIEW_SUMMARY' }
    | { type: 'CLOSE_REVIEW_SUMMARY' }
    | { type: 'SET_IS_SAVING'; payload: boolean }
    | { type: 'FINALIZE_SUCCESS'; payload: { attemptId: string | null } }
    | { type: 'SET_ERROR'; payload: any };

// --- INITIALIZATION HELPERS ---

export const createInitialAttempt = (topicId: string = '', sectionType: SectionType = 'practice', quizId: string = ''): QuizAttemptState => ({
    id: null,
    topicId,
    sectionType,
    quizId,
    userAnswers: {},
    markedQuestions: {},
    crossedOffOptions: {}, // Initialized as empty Record<number, Set<string>>
    userTimeSpent: {},
    currentQuestionIndex: 0,
    status: 'initializing',
    highlightedHtml: {},
    practiceTestSettings: { prometricDelay: false, additionalTime: false },
    submittedAnswers: {},
    timer: { value: 0, isActive: false, isCountdown: false, initialDuration: 0 }
});

export const initialState: QuizState = {
    status: 'initializing',
    quizIdentifiers: null,
    quizContent: { metadata: null, questions: [] },
    attempt: createInitialAttempt(),
    timer: { value: 0, isActive: false, isCountdown: false, initialDuration: 0 },
    uiState: {
        showExplanation: {},
        tempReveal: {},
        isExhibitVisible: false,
        isSaving: false,
        isNavActionInProgress: false
    },
    error: null,
};

// --- REDUCER FUNCTION ---

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
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
                timer: {
                    ...state.timer,
                    isActive: true,
                    isCountdown: true,
                    value: action.payload.duration,
                    initialDuration: action.payload.duration,
                }
            };

        case 'PROMPT_REGISTRATION':
            return {
                ...state,
                status: 'prompting_registration',
                timer: { ...state.timer, isActive: false },
            };

        case 'CLOSE_REGISTRATION_PROMPT':
             return {
                ...state,
                status: 'active',
                timer: { ...state.timer, isActive: true },
             };

        case 'PROMPT_RESUME': {
            // Ensure timer has valid defaults if missing from loaded data
            const loadedTimer = action.payload.attempt.timer || initialState.timer;
            return {
                ...state,
                status: 'prompting_resume',
                attempt: {
                    ...state.attempt, 
                    ...action.payload.attempt,
                    highlightedHtml: action.payload.attempt.highlightedHtml || {},
                },
                timer: loadedTimer,
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
                attempt: {
                    ...initialState.attempt,
                    id: action.payload.attemptId,
                    topicId: state.quizIdentifiers?.topicId || '',
                    sectionType: state.quizIdentifiers?.sectionType || 'practice',
                    quizId: state.quizIdentifiers?.quizId || '',
                    practiceTestSettings: action.payload.settings || { prometricDelay: false, additionalTime: false },
                },
                timer: { 
                    value: startTimerValue, 
                    isActive: true, 
                    isCountdown, 
                    initialDuration: startTimerValue 
                }
            };
        }

        case 'RESUME_ATTEMPT':
            return {
                ...state,
                status: state.quizIdentifiers?.reviewAttemptId ? 'reviewing_attempt' : 'active',
                timer: { 
                    ...state.timer, 
                    isActive: !state.quizIdentifiers?.reviewAttemptId 
                }
            };

        case 'RESET_ATTEMPT':
            return {
                ...state,
                status: 'active',
                attempt: {
                    ...initialState.attempt,
                    id: action.payload.newAttemptId,
                    topicId: state.quizIdentifiers?.topicId || '',
                    sectionType: state.quizIdentifiers?.sectionType || 'practice',
                    quizId: state.quizIdentifiers?.quizId || '',
                },
                timer: { ...initialState.timer, isActive: true }
            };
            
        case 'TIMER_TICK':
            return {
                ...state,
                timer: {
                    ...state.timer,
                    value: state.timer.isCountdown ? state.timer.value - 1 : state.timer.value + 1,
                },
            };
            
        case 'STOP_TIMER':
            return {
                ...state,
                timer: { ...state.timer, isActive: false },
            };

        case 'SUBMIT_CURRENT_ANSWER': {
            const currentIndex = state.attempt.currentQuestionIndex;
            if (state.attempt.userAnswers[currentIndex]) {
                return {
                    ...state,
                    attempt: {
                        ...state.attempt,
                        submittedAnswers: {
                            ...state.attempt.submittedAnswers,
                            [currentIndex]: true,
                        },
                    },
                };
            }
            return state;
        }
        
        case 'UPDATE_TIME_SPENT': {
            const { questionIndex, time } = action.payload;
            const existingTime = state.attempt.userTimeSpent[questionIndex] || 0;
            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    userTimeSpent: {
                        ...state.attempt.userTimeSpent,
                        [questionIndex]: existingTime + time,
                    },
                },
            };
        }

        case 'SELECT_OPTION': {
            const { questionIndex, optionLabel } = action.payload;
            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    userAnswers: {
                        ...state.attempt.userAnswers,
                        [questionIndex]: optionLabel,
                    },
                },
            };
        }

        case 'TOGGLE_CROSS_OFF': {
            const { questionIndex, optionLabel } = action.payload;
            const newCrossedOff = { ...state.attempt.crossedOffOptions };
            
            // Ensure Set exists for this index before modification
            const currentSet = newCrossedOff[questionIndex] 
                ? new Set(newCrossedOff[questionIndex]) 
                : new Set<string>();

            if (currentSet.has(optionLabel)) {
                currentSet.delete(optionLabel);
            } else {
                currentSet.add(optionLabel);
            }
            newCrossedOff[questionIndex] = currentSet;

            // If user crosses off their selected answer, deselect it
            const newAnswers = { ...state.attempt.userAnswers };
            if (currentSet.has(newAnswers[questionIndex])) {
                delete newAnswers[questionIndex];
            }

            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    userAnswers: newAnswers,
                    crossedOffOptions: newCrossedOff,
                },
            };
        }

        case 'NAVIGATE_QUESTION':
            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    currentQuestionIndex: action.payload,
                },
            };

        case 'TOGGLE_MARK': {
             const newMarked = { ...state.attempt.markedQuestions };
             if (newMarked[action.payload]) {
                 delete newMarked[action.payload];
             } else {
                 newMarked[action.payload] = true;
             }
            return {
                ...state,
                attempt: { ...state.attempt, markedQuestions: newMarked }
            };
        }
        
        case 'TOGGLE_EXHIBIT':
            return { 
                ...state, 
                uiState: { 
                    ...state.uiState, 
                    isExhibitVisible: !state.uiState.isExhibitVisible 
                }
            };
        
        case 'TOGGLE_SOLUTION': {
            const qIndex = state.attempt.currentQuestionIndex;
            return { 
                ...state, 
                uiState: { 
                    ...state.uiState, 
                    tempReveal: { 
                        ...state.uiState.tempReveal, 
                        [qIndex]: !state.uiState.tempReveal[qIndex] 
                    }
                }
            };
        }

        case 'TOGGLE_EXPLANATION': {
            const qIndex = state.attempt.currentQuestionIndex;
            return { 
                ...state, 
                uiState: { 
                    ...state.uiState, 
                    showExplanation: { 
                        ...state.uiState.showExplanation, 
                        [qIndex]: !state.uiState.showExplanation[qIndex]
                    }
                }
            };
        }

        case 'UPDATE_HIGHLIGHT': {
            const { contentKey, html } = action.payload;
            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    highlightedHtml: {
                        ...state.attempt.highlightedHtml,
                        [contentKey]: html
                    }
                }
            };
        }

        case 'OPEN_REVIEW_SUMMARY':
            return { ...state, status: 'reviewing_summary' };
        
        case 'CLOSE_REVIEW_SUMMARY':
            return { 
                ...state, 
                status: 'active', 
                timer: { ...state.timer, isActive: true } 
            };

        case 'SET_IS_SAVING':
            return { 
                ...state, 
                uiState: { ...state.uiState, isSaving: action.payload } 
            };
        
        case 'FINALIZE_SUCCESS':
            return { 
                ...state, 
                status: 'completed', 
                attempt: { ...state.attempt, id: action.payload.attemptId }
            };

        case 'SET_ERROR':
            return { ...state, status: 'error', error: action.payload };

        default:
            return state;
    }
}