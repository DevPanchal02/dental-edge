import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveInProgressAttempt, deleteInProgressAttempt, finalizeQuizAttempt } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Logic imports
import { quizReducer, initialState, createInitialAttempt } from './quiz/quizReducer';
import { useQuizInitialization } from './quiz/useQuizInitialization';
import { 
    getLocalAttemptKey, 
    getResultsKey, 
    saveToLocalStorage, 
    clearLocalStorage,
    serializeAttemptForApi 
} from './quiz/quizStorageUtils';

// Types
import { SectionType } from '../types/content.types';
import { PracticeTestSettings } from '../components/PracticeTestOptions';
import { QuizResult } from '../types/quiz.types';

export const useQuizEngine = (
    topicId: string, 
    sectionType: SectionType, 
    quizId: string, 
    reviewAttemptId?: string | null, 
    isPreviewMode: boolean = false
) => {
    const [state, dispatch] = useReducer(quizReducer, initialState);
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    
    const questionStartTimeRef = useRef<number | null>(null);

    // 1. Initialize Data
    useQuizInitialization({
        topicId, sectionType, quizId, reviewAttemptId, isPreviewMode, dispatch, currentUser: userProfile, userProfile
    });

    // 2. Question Timing (Time spent per question, NOT global timer)
    useEffect(() => {
        if (state.status === 'active') {
            questionStartTimeRef.current = Date.now();
        }
    }, [state.status, state.attempt.currentQuestionIndex]);

    // 3. Persistence Actions (Now require timerValue injection)
    
    const saveProgress = useCallback(async (currentTimerValue: number) => {
        const isFreeUser = userProfile?.tier === 'free';
        
        // Don't save if preview, free user, or no attempt ID
        if (isPreviewMode || isFreeUser || !state.attempt.id) return;

        dispatch({ type: 'SET_IS_SAVING', payload: true });
        
        // Sync the snapshot first
        const timerData = { 
            ...state.timerSnapshot, 
            value: currentTimerValue
            // isActive removed from type definition
        };

        const serializableAttempt = serializeAttemptForApi(state.attempt);
        const fullDataToSave = { 
            ...serializableAttempt, 
            timer: timerData 
        };

        // Save to Local Storage
        const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
        saveToLocalStorage(localKey, fullDataToSave);

        // Save to Server
        try {
            await saveInProgressAttempt(fullDataToSave);
        } catch (e) {
            console.error("Auto-save failed", e);
        } finally {
            setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);
        }

    }, [state.attempt, state.timerSnapshot, isPreviewMode, userProfile, topicId, sectionType, quizId]);


    // --- HELPER ACTIONS ---

    const recordTimeAndNavigate = useCallback((newIndex: number) => {
        const totalQuestions = state.quizContent.questions.length;
        if (newIndex >= 0 && newIndex < totalQuestions) {
            const timeNow = Date.now();
            const startTime = questionStartTimeRef.current;
            if (startTime) {
                const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
                dispatch({ type: 'UPDATE_TIME_SPENT', payload: { questionIndex: state.attempt.currentQuestionIndex, time: elapsedSeconds }});
            }
            questionStartTimeRef.current = timeNow;

            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [state.quizContent.questions.length, state.attempt.currentQuestionIndex]);


    // --- PUBLIC ACTIONS ---

    const actions = {
        selectOption: useCallback((questionIndex: number, optionLabel: string) => 
            dispatch({ type: 'SELECT_OPTION', payload: { questionIndex, optionLabel } }), []),
            
        toggleCrossOff: useCallback((questionIndex: number, optionLabel: string) => 
            dispatch({ type: 'TOGGLE_CROSS_OFF', payload: { questionIndex, optionLabel } }), []),

        updateHighlight: useCallback((contentKey: string, html: string) => 
            dispatch({ type: 'UPDATE_HIGHLIGHT', payload: { contentKey, html } }), []),

        toggleMark: useCallback(() => {
            if (isPreviewMode) return;
            dispatch({ type: 'TOGGLE_MARK', payload: state.attempt.currentQuestionIndex });
        }, [state.attempt.currentQuestionIndex, isPreviewMode]),

        toggleExhibit: useCallback(() => dispatch({ type: 'TOGGLE_EXHIBIT' }), []),
        toggleSolution: useCallback(() => dispatch({ type: 'TOGGLE_SOLUTION' }), []),
        toggleExplanation: useCallback(() => dispatch({ type: 'TOGGLE_EXPLANATION' }), []),
        
        closeReviewSummary: useCallback(() => dispatch({ type: 'CLOSE_REVIEW_SUMMARY' }), []),
        resumeAttempt: useCallback(() => dispatch({ type: 'RESUME_ATTEMPT' }), []),
        closeRegistrationPrompt: useCallback(() => dispatch({ type: 'CLOSE_REGISTRATION_PROMPT' }), []),

        startAttemptWithOptions: useCallback(async (settings: PracticeTestSettings) => {
            const baseMinutes = 60; 
            const modifier = settings.additionalTime ? 1.5 : 1.0;
            const durationSeconds = Math.round(baseMinutes * 60 * modifier);

            if (isPreviewMode) {
                dispatch({ type: 'START_PREVIEW', payload: { settings, duration: durationSeconds } });
                return;
            }

            const isFreeUser = userProfile?.tier === 'free';
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            const timerData = { value: durationSeconds, isCountdown: true, initialDuration: durationSeconds };
            
            let attemptId: string | undefined;

            if (isFreeUser) {
                attemptId = `local-${Date.now()}`;
            } else {
                try {
                    attemptId = await saveInProgressAttempt({ 
                        topicId, sectionType, quizId, status: 'active',
                        practiceTestSettings: settings,
                        timer: timerData,
                        userAnswers: {}, markedQuestions: {}, crossedOffOptions: {}, userTimeSpent: {}
                    });
                } catch (e) {
                    console.error("Failed to create attempt on server", e);
                }
            }

            if (attemptId && state.quizContent.metadata) {
                const initialAttemptState = { 
                    ...createInitialAttempt(topicId, sectionType, quizId), 
                    id: attemptId, 
                    practiceTestSettings: settings 
                };
                saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

                dispatch({ 
                    type: 'SET_DATA_AND_START', 
                    payload: { 
                        questions: state.quizContent.questions, 
                        metadata: state.quizContent.metadata, 
                        attemptId,
                        settings,
                        initialDuration: durationSeconds
                    } 
                });
            }
        }, [isPreviewMode, topicId, sectionType, quizId, userProfile, state.quizContent]),

        nextQuestion: useCallback(() => {
            if (isPreviewMode && state.attempt.currentQuestionIndex === 1) {
                dispatch({ type: 'PROMPT_REGISTRATION' });
                return;
            }
            recordTimeAndNavigate(state.attempt.currentQuestionIndex + 1);
        }, [state.attempt.currentQuestionIndex, recordTimeAndNavigate, isPreviewMode]),

        previousQuestion: useCallback(() => {
            recordTimeAndNavigate(state.attempt.currentQuestionIndex - 1);
        }, [state.attempt.currentQuestionIndex, recordTimeAndNavigate]),

        jumpToQuestion: useCallback((index: number) => {
            recordTimeAndNavigate(index);
            dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
        }, [recordTimeAndNavigate]),
        
        openReviewSummary: useCallback(async () => {
            if (isPreviewMode) {
                dispatch({ type: 'PROMPT_REGISTRATION' });
                return;
            }
            const timeNow = Date.now();
            const startTime = questionStartTimeRef.current;
            if (startTime) {
                const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
                dispatch({ type: 'UPDATE_TIME_SPENT', payload: { questionIndex: state.attempt.currentQuestionIndex, time: elapsedSeconds }});
            }
            questionStartTimeRef.current = null; 
            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            
            dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
        }, [isPreviewMode, state.attempt.currentQuestionIndex]),
        
        startNewAttempt: useCallback(async () => {
            if (isPreviewMode) return;

            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            clearLocalStorage(localKey);
            
            const isFreeUser = userProfile?.tier === 'free';

            if (state.attempt.id && !isFreeUser) {
                await deleteInProgressAttempt(state.attempt.id);
            }
            
            if (sectionType === 'practice' && state.quizContent.metadata) {
                dispatch({
                    type: 'PROMPT_OPTIONS',
                    payload: {
                        questions: state.quizContent.questions,
                        metadata: state.quizContent.metadata
                    }
                });
            } else {
                const timerData = { value: 0, isCountdown: false, initialDuration: 0 };
                let newAttemptId: string | undefined;

                if (isFreeUser) {
                    newAttemptId = `local-${Date.now()}`;
                } else {
                     newAttemptId = await saveInProgressAttempt({ 
                         topicId, sectionType, quizId, status: 'active', timer: timerData,
                         userAnswers: {}, markedQuestions: {}, crossedOffOptions: {}, userTimeSpent: {}
                     });
                }

                const initialAttemptState = { ...createInitialAttempt(topicId, sectionType, quizId), id: newAttemptId };
                saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

                dispatch({ type: 'RESET_ATTEMPT', payload: { newAttemptId: newAttemptId! } });
            }
        }, [state.attempt.id, topicId, sectionType, quizId, isPreviewMode, userProfile, state.quizContent]),

        finalizeAttempt: useCallback(async (finalTimerValue: number) => {
            if (isPreviewMode) {
                navigate('/');
                return;
            }

            try {
                const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                const resultsKey = getResultsKey(topicId, sectionType, quizId);

                dispatch({ type: 'SET_IS_SAVING', payload: true });

                const serializableAttempt = serializeAttemptForApi(state.attempt);
                // isActive removed from type, so we don't need to pass it
                const timerData = { ...state.timerSnapshot, value: finalTimerValue };

                const { score } = await finalizeQuizAttempt({ ...serializableAttempt, timer: timerData });
                
                const results: QuizResult = {
                    score,
                    totalQuestions: state.quizContent.questions.length,
                    totalValidQuestions: state.quizContent.questions.length,
                    userAnswers: state.attempt.userAnswers,
                    timestamp: Date.now(),
                    quizName: state.quizContent.metadata?.fullNameForDisplay,
                    correctIndices: [] as number[],
                    incorrectIndices: [] as number[]
                };
                
                state.quizContent.questions.forEach((q, idx) => {
                    const correctOpt = q.options.find(o => o.is_correct);
                    if (correctOpt && state.attempt.userAnswers[idx] === correctOpt.label) {
                        results.correctIndices.push(idx);
                    } else {
                        results.incorrectIndices.push(idx);
                    }
                });

                saveToLocalStorage(resultsKey, results);
                clearLocalStorage(localKey);
                
                dispatch({ type: 'FINALIZE_SUCCESS', payload: { attemptId: state.attempt.id } });
                navigate(`/app/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        }, [state.attempt, state.timerSnapshot, state.quizContent, topicId, sectionType, quizId, navigate, isPreviewMode]),

        // Expose save for the orchestrator
        saveProgress
    };

    return { state, actions };
};