// FILE: client/src/hooks/useQuizEngine.js

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuizData, getQuizMetadata } from '../services/loader';
import {
    getInProgressAttempt,
    saveInProgressAttempt,
    deleteInProgressAttempt,
    finalizeQuizAttempt,
    getQuizAttemptById,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const getLocalAttemptKey = (topicId, sectionType, quizId) => `inProgress-${topicId}-${sectionType}-${quizId}`;
const saveToLocalStorage = (key, data) => {
    try {
        const serializedData = { ...data };
        if (serializedData.crossedOffOptions) {
            serializedData.crossedOffOptions = Object.fromEntries(
                Object.entries(serializedData.crossedOffOptions).map(([key, value]) => [key, Array.from(value)])
            );
        }
        localStorage.setItem(key, JSON.stringify(serializedData));
    } catch (e) {
        console.error("Error saving to localStorage", e);
    }
};
const loadFromLocalStorage = (key) => {
    try {
        const data = localStorage.getItem(key);
        const parsedData = data ? JSON.parse(data) : null;
        if (parsedData && parsedData.crossedOffOptions) {
            parsedData.crossedOffOptions = Object.fromEntries(
                Object.entries(parsedData.crossedOffOptions).map(([key, value]) => [key, new Set(value)])
            );
        }
        return parsedData;
    } catch (e) {
        console.error("Error loading from localStorage", e);
        return null;
    }
};
const clearLocalStorage = (key) => {
    localStorage.removeItem(key);
};


const initialState = {
    status: 'initializing',
    quizIdentifiers: null,
    quizContent: { metadata: null, questions: [] },
    attempt: {
        id: null,
        userAnswers: {},
        markedQuestions: {},
        crossedOffOptions: {},
        userTimeSpent: {},
        currentQuestionIndex: 0,
        practiceTestSettings: { prometricDelay: false, additionalTime: false },
        submittedAnswers: {},
    },
    timer: {
        value: 0,
        isActive: false,
        isCountdown: false,
        initialDuration: 0,
    },
    uiState: {
        showExplanation: {},
        tempReveal: {},
        isExhibitVisible: false,
        isSaving: false,
        highlightedHtml: {},
    },
    error: null,
};

function quizReducer(state, action) {
    // Reducer logic remains unchanged...
    switch (action.type) {
        case 'INITIALIZE_ATTEMPT':
            return {
                ...initialState,
                status: 'loading',
                quizIdentifiers: action.payload,
            };

        case 'PROMPT_PREVIEW_OPTIONS':
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

        case 'PROMPT_RESUME':
            return {
                ...state,
                status: 'prompting_resume',
                attempt: action.payload.attempt,
                timer: action.payload.attempt.timer || initialState.timer,
                quizContent: {
                    questions: action.payload.questions,
                    metadata: action.payload.metadata,
                },
            };

        case 'SET_DATA_AND_START':
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
                },
                timer: {
                    ...initialState.timer,
                    isActive: true,
                }
            };

        case 'RESUME_ATTEMPT':
            return {
                ...state,
                status: 'active',
                timer: {
                    ...state.timer,
                    isActive: true,
                }
            };

        case 'RESET_ATTEMPT':
            return {
                ...state,
                status: 'active',
                attempt: {
                    ...initialState.attempt,
                    id: action.payload.newAttemptId,
                },
                timer: {
                    ...initialState.timer,
                    isActive: true,
                }
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
            const currentSet = newCrossedOff[questionIndex] ? new Set(newCrossedOff[questionIndex]) : new Set();

            if (currentSet.has(optionLabel)) {
                currentSet.delete(optionLabel);
            } else {
                currentSet.add(optionLabel);
            }
            newCrossedOff[questionIndex] = currentSet;

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
            return { ...state, uiState: { ...state.uiState, isExhibitVisible: !state.uiState.isExhibitVisible }};
        
        case 'TOGGLE_SOLUTION': {
            const qIndex = state.attempt.currentQuestionIndex;
            return { ...state, uiState: { ...state.uiState, tempReveal: { ...state.uiState.tempReveal, [qIndex]: !state.uiState.tempReveal[qIndex] }}};
        }

        case 'TOGGLE_EXPLANATION': {
            const qIndex = state.attempt.currentQuestionIndex;
            return { ...state, uiState: { ...state.uiState, showExplanation: { ...state.uiState.showExplanation, [qIndex]: !state.uiState.showExplanation[qIndex]}}};
        }

        case 'OPEN_REVIEW_SUMMARY':
            return { ...state, status: 'reviewing_summary' };
        
        case 'CLOSE_REVIEW_SUMMARY':
            return { ...state, status: 'active', timer: { ...state.timer, isActive: true } };

        case 'SET_IS_SAVING':
            return { ...state, uiState: { ...state.uiState, isSaving: action.payload } };
        
        case 'FINALIZE_SUCCESS':
            return { ...state, status: 'completed', attempt: { ...state.attempt, id: action.payload.attemptId }};

        case 'SET_ERROR':
            return { ...state, status: 'error', error: action.payload };

        default:
            return state;
    }
}

export const useQuizEngine = (topicId, sectionType, quizId, reviewAttemptId, isPreviewMode) => {
    const [state, dispatch] = useReducer(quizReducer, initialState);
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    const timerIntervalRef = useRef(null);
    const saveProgressToServerRef = useRef();
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        const initialize = async () => {
            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: { topicId, sectionType, quizId, reviewAttemptId, isPreviewMode } });
            
            try {
                const [questions, metadata] = await Promise.all([
                    getQuizData(topicId, sectionType, quizId, isPreviewMode),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);

                if (isPreviewMode) {
                    const previewMetadata = {
                        ...metadata,
                        fullNameForDisplay: 'Dental Aptitude Test 1',
                        categoryForInstructions: 'DAT',
                    };
                    dispatch({ type: 'PROMPT_PREVIEW_OPTIONS', payload: { questions, metadata: previewMetadata } });
                    return;
                }
                
                if (!currentUser) return;

                if (reviewAttemptId) {
                    // Review mode logic
                } else {
                    const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                    let inProgressAttempt = loadFromLocalStorage(localKey);

                    if (!inProgressAttempt) {
                        inProgressAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    }

                    if (inProgressAttempt) {
                        dispatch({ type: 'PROMPT_RESUME', payload: { attempt: inProgressAttempt, questions, metadata } });
                    } else {
                        const newAttemptData = { ...initialState.attempt };
                        const timerData = { ...initialState.timer };
                        const attemptId = await saveInProgressAttempt({ topicId, sectionType, quizId, ...newAttemptData, timer: timerData });
                        saveToLocalStorage(localKey, { ...newAttemptData, id: attemptId, timer: timerData });
                        dispatch({ type: 'SET_DATA_AND_START', payload: { questions, metadata, attemptId } });
                    }
                }
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        };

        initialize();

        return () => {
            clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, reviewAttemptId, currentUser, isPreviewMode]);
    
    const saveProgressToServer = useCallback(async () => {
        if (isPreviewMode || !((state.status === 'active' || state.status === 'reviewing_summary') && state.attempt.id)) {
            return;
        }
        
        dispatch({ type: 'SET_IS_SAVING', payload: true });
        
        const serializableAttempt = { ...state.attempt };
        if (serializableAttempt.crossedOffOptions) {
            serializableAttempt.crossedOffOptions = Object.fromEntries(
                Object.entries(serializableAttempt.crossedOffOptions).map(([key, value]) => [key, Array.from(value)])
            );
        }

        await saveInProgressAttempt({ 
            topicId, 
            sectionType, 
            quizId, 
            ...serializableAttempt,
            timer: state.timer
        });
        setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);

    }, [state.attempt, state.timer, topicId, sectionType, quizId, state.status, isPreviewMode]);

    useEffect(() => {
        saveProgressToServerRef.current = saveProgressToServer;
    }, [saveProgressToServer]);

    useEffect(() => {
        let autoSaveInterval;
        if (state.status === 'active' && state.attempt.id && !isPreviewMode) {
            autoSaveInterval = setInterval(() => {
                if (saveProgressToServerRef.current) {
                    saveProgressToServerRef.current();
                }
            }, 60000);
        }
        return () => clearInterval(autoSaveInterval);
    }, [state.status, state.attempt.id, isPreviewMode]);

    useEffect(() => {
        if ((state.status === 'active' || state.status === 'reviewing_summary') && state.attempt.id && !isPreviewMode) {
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            const dataToSave = { ...state.attempt, timer: state.timer };
            saveToLocalStorage(localKey, dataToSave);
        }
    }, [state.attempt, state.timer, state.status, topicId, sectionType, quizId, isPreviewMode]);

    useEffect(() => {
        if (state.timer.isActive && (state.status === 'active' || state.status === 'reviewing_summary')) {
            timerIntervalRef.current = setInterval(() => {
                dispatch({ type: 'TIMER_TICK' });
            }, 1000);
        } else {
            clearInterval(timerIntervalRef.current);
        }
        return () => clearInterval(timerIntervalRef.current);
    }, [state.timer.isActive, state.status]);
    
    const selectOption = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'SELECT_OPTION', payload: { questionIndex, optionLabel } });
    }, []);

    const toggleCrossOff = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'TOGGLE_CROSS_OFF', payload: { questionIndex, optionLabel } });
    }, []);

    const navigateQuestion = useCallback((newIndex) => {
        const totalQuestions = state.quizContent.questions.length;
        if (newIndex >= 0 && newIndex < totalQuestions) {
            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [state.quizContent.questions.length]);
    
    const openReviewSummary = useCallback(async () => {
        if (isPreviewMode) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }

        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        await saveProgressToServer();
        dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
    }, [saveProgressToServer, isPreviewMode]);
    
    const nextQuestion = useCallback(() => {
        if (isPreviewMode && state.attempt.currentQuestionIndex === 1) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }

        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        const newIndex = state.attempt.currentQuestionIndex + 1;
        if (newIndex < state.quizContent.questions.length) {
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        } else {
            openReviewSummary();
        }
    }, [state.attempt.currentQuestionIndex, state.quizContent.questions.length, openReviewSummary, isPreviewMode]);
    
    const previousQuestion = useCallback(() => {
        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        const newIndex = state.attempt.currentQuestionIndex - 1;
        if (newIndex >= 0) {
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [state.attempt.currentQuestionIndex]);
    
    const jumpToQuestion = useCallback((index) => {
        if (index >= 0 && index < state.quizContent.questions.length) {
            dispatch({ type: 'NAVIGATE_QUESTION', payload: index });
            dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
        }
    }, [state.quizContent.questions.length]);

    const toggleMark = useCallback(() => {
        if (isPreviewMode) return;
        dispatch({ type: 'TOGGLE_MARK', payload: state.attempt.currentQuestionIndex });
    }, [state.attempt.currentQuestionIndex, isPreviewMode]);

    const closeReviewSummary = useCallback(() => dispatch({ type: 'CLOSE_REVIEW_SUMMARY' }), []);
    const toggleExhibit = useCallback(() => dispatch({ type: 'TOGGLE_EXHIBIT' }), []);
    const toggleSolution = useCallback(() => dispatch({ type: 'TOGGLE_SOLUTION' }), []);
    const toggleExplanation = useCallback(() => dispatch({ type: 'TOGGLE_EXPLANATION' }), []);

    const resumeAttempt = useCallback(() => dispatch({ type: 'RESUME_ATTEMPT' }), []);
    
    const startNewAttempt = useCallback(async () => {
        if (isPreviewMode) return;
        const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
        clearLocalStorage(localKey);
        await deleteInProgressAttempt(state.attempt.id);
        const newAttemptData = { ...initialState.attempt };
        const newAttemptId = await saveInProgressAttempt({ topicId, sectionType, quizId, ...newAttemptData, timer: initialState.timer });
        saveToLocalStorage(localKey, { ...newAttemptData, id: newAttemptId, timer: initialState.timer });
        dispatch({ type: 'RESET_ATTEMPT', payload: { newAttemptId } });
    }, [state.attempt.id, topicId, sectionType, quizId, isPreviewMode]);

    // --- THIS IS THE FIX ---
    const finalizeAttempt = useCallback(async () => {
        if (isPreviewMode) {
            navigate('/');
            return;
        }
        try {
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            // This helper function was defined outside the hook's scope, causing the error.
            // Move it inside or define it where it's accessible.
            const getResultsKey = (tId, sType, qId) => `quizResults-${tId}-${sType}-${qId}`;
            const resultsKey = getResultsKey(topicId, sectionType, quizId);

            dispatch({ type: 'STOP_TIMER' });
            dispatch({ type: 'SET_IS_SAVING', payload: true });

            const { score } = await finalizeQuizAttempt({ topicId, sectionType, quizId, ...state.attempt, timer: state.timer });
            
            const results = {
                score,
                totalQuestions: state.quizContent.questions.length,
                totalValidQuestions: state.quizContent.questions.length,
                userAnswers: state.attempt.userAnswers,
                timestamp: Date.now(),
                quizName: state.quizContent.metadata?.fullNameForDisplay,
            };

            saveToLocalStorage(resultsKey, results);
            
            clearLocalStorage(localKey);
            
            dispatch({ type: 'FINALIZE_SUCCESS', payload: { attemptId: state.attempt.id } });
            navigate(`/app/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: error });
        }
    }, [state.attempt, state.timer, state.quizContent, topicId, sectionType, quizId, navigate, isPreviewMode]);

    const startPreview = useCallback((settings) => {
        const duration = 180 * 60; 
        dispatch({ type: 'START_PREVIEW', payload: { settings, duration }});
    }, []);

    const closeRegistrationPrompt = useCallback(() => {
        dispatch({ type: 'CLOSE_REGISTRATION_PROMPT' });
    }, []);

    const actions = {
        selectOption, toggleCrossOff, nextQuestion,
        previousQuestion, navigateQuestion, jumpToQuestion,
        toggleMark, toggleExhibit, toggleSolution, 
        toggleExplanation, openReviewSummary, closeReviewSummary, 
        resumeAttempt, startNewAttempt, finalizeAttempt,
        startPreview, closeRegistrationPrompt,
    };

    return { state, actions };
};
