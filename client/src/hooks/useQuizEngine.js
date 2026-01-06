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
        
        // --- THIS IS THE FIX (Part 1): Simplified Reducer Action ---
        // This action now receives the PRE-CALCULATED time and simply updates the state.
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
    
    const questionStartTimeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const saveProgressToServerRef = useRef();
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const initialize = async () => {
            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: { topicId, sectionType, quizId, reviewAttemptId, isPreviewMode } });
            
            try {
                // Timeout promise to prevent infinite loading state
                const fetchData = Promise.all([
                    getQuizData(topicId, sectionType, quizId, isPreviewMode),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);

                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 15000)
                );

                const [questions, metadata] = await Promise.race([fetchData, timeout]);

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
                    // Review Logic: Directly fetch the specific attempt
                    const reviewData = await getQuizAttemptById(reviewAttemptId);
                    // Hijack the resume prompt to load data, then immediately signal resumption
                    dispatch({ type: 'PROMPT_RESUME', payload: { attempt: reviewData, questions, metadata } });
                    dispatch({ type: 'RESUME_ATTEMPT' }); 
                } else {
                    const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                    let inProgressAttempt = loadFromLocalStorage(localKey);

                    if (!inProgressAttempt) {
                        // We use standard await here; if it hangs, the user can refresh, but the critical path is the quiz data above.
                        inProgressAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    }

                    if (inProgressAttempt) {
                        // Sanitization: Convert stored arrays back to Sets to prevent React crashes
                        let sanitizedCrossedOff = {};
                        if (inProgressAttempt.crossedOffOptions && typeof inProgressAttempt.crossedOffOptions === 'object') {
                            try {
                                sanitizedCrossedOff = Object.fromEntries(
                                    Object.entries(inProgressAttempt.crossedOffOptions).map(([key, value]) => {
                                        return [key, new Set(Array.isArray(value) ? value : [])];
                                    })
                                );
                            } catch (e) {
                                console.warn("Failed to sanitize crossedOffOptions", e);
                            }
                        }
                        inProgressAttempt.crossedOffOptions = sanitizedCrossedOff;

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
                console.error("Initialization Error:", error);
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        };

        initialize();

        return () => {
            clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, reviewAttemptId, currentUser, isPreviewMode]);
    
    // This effect now ONLY resets the question start time when the quiz becomes active.
    useEffect(() => {
        if (state.status === 'active') {
            questionStartTimeRef.current = Date.now();
        }
    }, [state.status, state.attempt.currentQuestionIndex]);
    
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
            topicId, sectionType, quizId, ...serializableAttempt, timer: state.timer
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
    
    // --- THIS IS THE FIX (Part 2): Navigation actions now handle time calculation ---
    const recordTimeAndNavigate = useCallback((newIndex) => {
        const totalQuestions = state.quizContent.questions.length;
        if (newIndex >= 0 && newIndex < totalQuestions) {
            // Calculate time spent on the current question
            const timeNow = Date.now();
            const startTime = questionStartTimeRef.current;
            if (startTime) {
                const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
                dispatch({ type: 'UPDATE_TIME_SPENT', payload: { questionIndex: state.attempt.currentQuestionIndex, time: elapsedSeconds }});
            }
            // Reset the timer for the new question
            questionStartTimeRef.current = timeNow;

            // Submit and navigate
            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [state.quizContent.questions.length, state.attempt.currentQuestionIndex]);

    const selectOption = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'SELECT_OPTION', payload: { questionIndex, optionLabel } });
    }, []);

    const toggleCrossOff = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'TOGGLE_CROSS_OFF', payload: { questionIndex, optionLabel } });
    }, []);
    
    const openReviewSummary = useCallback(async () => {
        if (isPreviewMode) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }

        // Record time for the final question before opening review
        const timeNow = Date.now();
        const startTime = questionStartTimeRef.current;
        if (startTime) {
            const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
            dispatch({ type: 'UPDATE_TIME_SPENT', payload: { questionIndex: state.attempt.currentQuestionIndex, time: elapsedSeconds }});
        }
        questionStartTimeRef.current = null; // Stop timer while in review

        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        await saveProgressToServer();
        dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
    }, [saveProgressToServer, isPreviewMode, state.attempt.currentQuestionIndex]);
    
    const nextQuestion = useCallback(() => {
        if (isPreviewMode && state.attempt.currentQuestionIndex === 1) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }
        recordTimeAndNavigate(state.attempt.currentQuestionIndex + 1);
    }, [state.attempt.currentQuestionIndex, recordTimeAndNavigate, isPreviewMode]);
    
    const previousQuestion = useCallback(() => {
        recordTimeAndNavigate(state.attempt.currentQuestionIndex - 1);
    }, [state.attempt.currentQuestionIndex, recordTimeAndNavigate]);
    
    const jumpToQuestion = useCallback((index) => {
        recordTimeAndNavigate(index);
        dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
    }, [recordTimeAndNavigate]);

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

    const finalizeAttempt = useCallback(async () => {
        if (isPreviewMode) {
            navigate('/');
            return;
        }
        try {
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
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
        previousQuestion, jumpToQuestion,
        toggleMark, toggleExhibit, toggleSolution, 
        toggleExplanation, openReviewSummary, closeReviewSummary, 
        resumeAttempt, startNewAttempt, finalizeAttempt,
        startPreview, closeRegistrationPrompt,
    };

    return { state, actions };
};
