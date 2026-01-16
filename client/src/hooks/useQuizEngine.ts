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
    
    // Refs for Timing and Autosave
    const questionStartTimeRef = useRef<number | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const saveProgressToServerRef = useRef<(() => Promise<void>) | undefined>(undefined);

    // 1. Initialize Data (Delegated to sub-hook)
    useQuizInitialization({
        topicId, sectionType, quizId, reviewAttemptId, isPreviewMode, dispatch, currentUser: userProfile, userProfile
    });

    // 2. Timer Logic
    useEffect(() => {
        if (state.status === 'active') {
            questionStartTimeRef.current = Date.now();
        }
    }, [state.status, state.attempt.currentQuestionIndex]);

    useEffect(() => {
        if (state.timer.isActive && (state.status === 'active' || state.status === 'reviewing_summary')) {
            timerIntervalRef.current = setInterval(() => {
                dispatch({ type: 'TIMER_TICK' });
            }, 1000);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [state.timer.isActive, state.status]);

    // 3. Server Auto-Save Logic (Critical for Paid Users)
    const saveProgressToServer = useCallback(async () => {
        const isFreeUser = userProfile?.tier === 'free';
        
        if (isPreviewMode || isFreeUser || !((state.status === 'active' || state.status === 'reviewing_summary') && state.attempt.id)) {
            return;
        }

        dispatch({ type: 'SET_IS_SAVING', payload: true });
        
        const serializableAttempt = serializeAttemptForApi(state.attempt);

        try {
            await saveInProgressAttempt({ 
                topicId, 
                sectionType, 
                quizId, 
                ...serializableAttempt, 
                timer: state.timer 
            });
        } catch (e) {
            console.error("Auto-save failed", e);
        } finally {
            setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);
        }

    }, [state.attempt, state.timer, topicId, sectionType, quizId, state.status, isPreviewMode, userProfile]);

    useEffect(() => {
        saveProgressToServerRef.current = saveProgressToServer;
    }, [saveProgressToServer]);

    useEffect(() => {
        let autoSaveInterval: ReturnType<typeof setInterval>;
        if (state.status === 'active' && state.attempt.id && !isPreviewMode) {
            autoSaveInterval = setInterval(() => {
                if (saveProgressToServerRef.current) {
                    saveProgressToServerRef.current();
                }
            }, 60000);
        }
        return () => clearInterval(autoSaveInterval);
    }, [state.status, state.attempt.id, isPreviewMode]);

    // 4. Local Storage Sync
    useEffect(() => {
        if ((state.status === 'active' || state.status === 'reviewing_summary') && state.attempt.id && !isPreviewMode) {
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            const dataToSave = { ...state.attempt, timer: state.timer };
            saveToLocalStorage(localKey, dataToSave);
        }
    }, [state.attempt, state.timer, state.status, topicId, sectionType, quizId, isPreviewMode]);


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

        // --- Handle Start with Options ---
        startAttemptWithOptions: useCallback(async (settings: PracticeTestSettings) => {
            // 1. Calculate Duration
            // Default to 60 mins if not specified, then apply 1.5x modifier if requested
            const baseMinutes = 60; 
            const modifier = settings.additionalTime ? 1.5 : 1.0;
            const durationSeconds = Math.round(baseMinutes * 60 * modifier);

            if (isPreviewMode) {
                dispatch({ type: 'START_PREVIEW', payload: { settings, duration: durationSeconds } });
                return;
            }

            // 2. Initialize Attempt (Server or Local)
            const isFreeUser = userProfile?.tier === 'free';
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            const timerData = { value: durationSeconds, isActive: true, isCountdown: true, initialDuration: durationSeconds };
            
            let attemptId: string | undefined;

            if (isFreeUser) {
                attemptId = `local-${Date.now()}`;
            } else {
                try {
                    attemptId = await saveInProgressAttempt({ 
                        topicId, 
                        sectionType, 
                        quizId, 
                        status: 'active',
                        practiceTestSettings: settings,
                        timer: timerData,
                        // Initialize empty maps
                        userAnswers: {}, markedQuestions: {}, crossedOffOptions: {}, userTimeSpent: {}
                    });
                } catch (e) {
                    console.error("Failed to create attempt on server", e);
                }
            }

            if (attemptId && state.quizContent.metadata) {
                // Save to local storage for redundancy/offline support
                const initialAttemptState = { 
                    ...createInitialAttempt(topicId, sectionType, quizId), 
                    id: attemptId, 
                    practiceTestSettings: settings 
                };
                saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

                // 3. Dispatch Start
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
            
            if (saveProgressToServerRef.current) {
                await saveProgressToServerRef.current();
            }

            dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
        }, [isPreviewMode, state.attempt.currentQuestionIndex]),
        
        // --- UPDATED: Start New Attempt (Reset Logic) ---
        startNewAttempt: useCallback(async () => {
            if (isPreviewMode) return;

            // 1. Cleanup Old Attempt Data (Local & Server)
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            clearLocalStorage(localKey);
            
            const isFreeUser = userProfile?.tier === 'free';

            if (state.attempt.id && !isFreeUser) {
                await deleteInProgressAttempt(state.attempt.id);
            }
            
            // 2. Branch Logic based on Section Type
            if (sectionType === 'practice' && state.quizContent.metadata) {
                // For Practice Tests, send user back to Options Screen
                // We reuse the loaded questions and metadata
                dispatch({
                    type: 'PROMPT_OPTIONS',
                    payload: {
                        questions: state.quizContent.questions,
                        metadata: state.quizContent.metadata
                    }
                });
            } else {
                // For Question Banks (or if metadata missing), start immediately (Original Logic)
                const timerData = { value: 0, isActive: false, isCountdown: false, initialDuration: 0 };
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

        finalizeAttempt: useCallback(async () => {
            if (isPreviewMode) {
                navigate('/');
                return;
            }

            try {
                const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                const resultsKey = getResultsKey(topicId, sectionType, quizId);

                dispatch({ type: 'STOP_TIMER' });
                dispatch({ type: 'SET_IS_SAVING', payload: true });

                const serializableAttempt = serializeAttemptForApi(state.attempt);

                const { score } = await finalizeQuizAttempt({ ...serializableAttempt, timer: state.timer });
                
                const results = {
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
        }, [state.attempt, state.timer, state.quizContent, topicId, sectionType, quizId, navigate, isPreviewMode])
    };

    return { state, actions };
};