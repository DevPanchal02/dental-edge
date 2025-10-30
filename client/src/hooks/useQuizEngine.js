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

        case 'PROMPT_RESUME':
            return {
                ...state,
                status: 'prompting_resume',
                attempt: action.payload.attempt,
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
            const currentCrossed = state.attempt.crossedOffOptions[questionIndex] || [];
            const newCrossedSet = new Set(currentCrossed);
            if (newCrossedSet.has(optionLabel)) {
                newCrossedSet.delete(optionLabel);
            } else {
                newCrossedSet.add(optionLabel);
            }
            const newAnswers = { ...state.attempt.userAnswers };
            if (newCrossedSet.has(newAnswers[questionIndex])) {
                delete newAnswers[questionIndex];
            }
            return {
                ...state,
                attempt: {
                    ...state.attempt,
                    userAnswers: newAnswers,
                    crossedOffOptions: {
                        ...state.attempt.crossedOffOptions,
                        [questionIndex]: Array.from(newCrossedSet),
                    },
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
            return { ...state, status: 'reviewing_summary', timer: { ...state.timer, isActive: false } };
        
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
    
    const autoSaveIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);

    useEffect(() => {
        const initialize = async () => {
            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: { topicId, sectionType, quizId, reviewAttemptId, isPreviewMode } });
            
            try {
                const [questions, metadata] = await Promise.all([
                    getQuizData(topicId, sectionType, quizId),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);

                if (reviewAttemptId) {
                    // TODO: Implement review mode loading logic
                } else {
                    const inProgressAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    if (inProgressAttempt) {
                        dispatch({ type: 'PROMPT_RESUME', payload: { attempt: inProgressAttempt, questions, metadata } });
                    } else {
                        const newAttemptData = { ...initialState.attempt };
                        const attemptId = await saveInProgressAttempt({ topicId, sectionType, quizId, ...newAttemptData });
                        dispatch({ type: 'SET_DATA_AND_START', payload: { questions, metadata, attemptId } });
                    }
                }
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        };

        if (currentUser || isPreviewMode) {
            initialize();
        }

        return () => {
            clearInterval(autoSaveIntervalRef.current);
            clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, reviewAttemptId, currentUser, isPreviewMode]);
    
    useEffect(() => {
        if (state.status === 'active' && state.attempt.id) {
            autoSaveIntervalRef.current = setInterval(async () => {
                dispatch({ type: 'SET_IS_SAVING', payload: true });
                await saveInProgressAttempt({ topicId, sectionType, quizId, ...state.attempt });
                setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);
            }, 60000);
        } else {
            clearInterval(autoSaveIntervalRef.current);
        }
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [state.status, state.attempt, topicId, sectionType, quizId]);

    useEffect(() => {
        if (state.timer.isActive) {
            timerIntervalRef.current = setInterval(() => {
                dispatch({ type: 'TIMER_TICK' });
            }, 1000);
        } else {
            clearInterval(timerIntervalRef.current);
        }
        return () => clearInterval(timerIntervalRef.current);
    }, [state.timer.isActive]);
    
    // --- THE FIX IS HERE ---
    // The `selectOption` function now correctly accepts two arguments,
    // matching what the QuestionCard component provides.
    const selectOption = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'SELECT_OPTION', payload: { questionIndex, optionLabel } });
    }, []); // No dependencies needed as dispatch is stable.

    const toggleCrossOff = useCallback((questionIndex, optionLabel) => {
        dispatch({ type: 'TOGGLE_CROSS_OFF', payload: { questionIndex, optionLabel } });
    }, []);

    const navigateQuestion = useCallback((newIndex) => {
        const totalQuestions = state.quizContent.questions.length;
        if (newIndex >= 0 && newIndex < totalQuestions) {
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [state.quizContent.questions.length]);
    
    const nextQuestion = useCallback(() => {
        const newIndex = state.attempt.currentQuestionIndex + 1;
        if (newIndex < state.quizContent.questions.length) {
            navigateQuestion(newIndex);
        } else {
            openReviewSummary();
        }
    }, [state.attempt.currentQuestionIndex, state.quizContent.questions.length, navigateQuestion]);
    
    const previousQuestion = useCallback(() => {
        navigateQuestion(state.attempt.currentQuestionIndex - 1);
    }, [state.attempt.currentQuestionIndex, navigateQuestion]);

    const toggleMark = useCallback(() => {
        dispatch({ type: 'TOGGLE_MARK', payload: state.attempt.currentQuestionIndex });
    }, [state.attempt.currentQuestionIndex]);

    const openReviewSummary = useCallback(async () => {
        dispatch({ type: 'SET_IS_SAVING', payload: true });
        await saveInProgressAttempt({ topicId, sectionType, quizId, ...state.attempt });
        dispatch({ type: 'SET_IS_SAVING', payload: false });
        dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
    }, [state.attempt, topicId, sectionType, quizId]);

    const closeReviewSummary = useCallback(() => dispatch({ type: 'CLOSE_REVIEW_SUMMARY' }), []);
    const toggleExhibit = useCallback(() => dispatch({ type: 'TOGGLE_EXHIBIT' }), []);
    const toggleSolution = useCallback(() => dispatch({ type: 'TOGGLE_SOLUTION' }), []);
    const toggleExplanation = useCallback(() => dispatch({ type: 'TOGGLE_EXPLANATION' }), []);

    const resumeAttempt = useCallback(() => dispatch({ type: 'RESUME_ATTEMPT' }), []);
    
    const startNewAttempt = useCallback(async () => {
        await deleteInProgressAttempt(state.attempt.id);
        const newAttemptData = { ...initialState.attempt };
        const newAttemptId = await saveInProgressAttempt({ topicId, sectionType, quizId, ...newAttemptData });
        dispatch({ type: 'SET_DATA_AND_START', payload: {
            questions: state.quizContent.questions,
            metadata: state.quizContent.metadata,
            attemptId: newAttemptId
        }});
    }, [state.attempt.id, state.quizContent, topicId, sectionType, quizId]);

    const finalizeAttempt = useCallback(async () => {
        try {
            dispatch({ type: 'STOP_TIMER' });
            dispatch({ type: 'SET_IS_SAVING', payload: true });
            const result = await finalizeQuizAttempt({ topicId, sectionType, quizId, ...state.attempt });
            dispatch({ type: 'FINALIZE_SUCCESS', payload: result });
            navigate(`/app/results/${topicId}/${sectionType}/${quizId}`, { state: { attemptId: result.attemptId }, replace: true });
        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: error });
        }
    }, [state.attempt, topicId, sectionType, quizId, navigate]);

    const actions = {
        selectOption, toggleCrossOff, nextQuestion,
        previousQuestion, navigateQuestion, toggleMark,
        toggleExhibit, toggleSolution, toggleExplanation,
        openReviewSummary, closeReviewSummary, resumeAttempt,
        startNewAttempt, finalizeAttempt,
    };

    return { state, actions };
};