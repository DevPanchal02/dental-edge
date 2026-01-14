import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveInProgressAttempt, deleteInProgressAttempt, finalizeQuizAttempt } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Logic imports
import { quizReducer, initialState } from './quiz/quizReducer';
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
    
    // FIX 1: Provide 'undefined' as the initial value for the generic useRef
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
        
        // Conditions to ABORT save
        if (isPreviewMode || isFreeUser || !((state.status === 'active' || state.status === 'reviewing_summary') && state.attempt.id)) {
            return;
        }

        dispatch({ type: 'SET_IS_SAVING', payload: true });
        
        // Serialize Sets to Arrays for API
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
            // Artificial delay to show "Saving..." briefly
            setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);
        }

    }, [state.attempt, state.timer, topicId, sectionType, quizId, state.status, isPreviewMode, userProfile]);

    // Keep ref updated
    useEffect(() => {
        saveProgressToServerRef.current = saveProgressToServer;
    }, [saveProgressToServer]);

    // Interval for Auto-Save (Every 1 minute)
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


    // 4. Local Storage Sync (Always runs)
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
        
        // FIX 2: Removed unused 'index' parameter. The reducer uses currentQuestionIndex from state.
        toggleExplanation: useCallback(() => dispatch({ type: 'TOGGLE_EXPLANATION' }), []),
        
        closeReviewSummary: useCallback(() => dispatch({ type: 'CLOSE_REVIEW_SUMMARY' }), []),
        resumeAttempt: useCallback(() => dispatch({ type: 'RESUME_ATTEMPT' }), []),
        closeRegistrationPrompt: useCallback(() => dispatch({ type: 'CLOSE_REGISTRATION_PROMPT' }), []),

        startPreview: useCallback((settings: { prometricDelay: boolean; additionalTime: boolean }) => { 
            const duration = 180 * 60; 
            dispatch({ type: 'START_PREVIEW', payload: { settings, duration } });
        }, []),

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

            // Record time for current question before opening summary
            const timeNow = Date.now();
            const startTime = questionStartTimeRef.current;
            if (startTime) {
                const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
                dispatch({ type: 'UPDATE_TIME_SPENT', payload: { questionIndex: state.attempt.currentQuestionIndex, time: elapsedSeconds }});
            }
            questionStartTimeRef.current = null; 

            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            
            // Trigger server save
            if (saveProgressToServerRef.current) {
                await saveProgressToServerRef.current();
            }

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
            
            // Create fresh attempt
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

            // Save fresh state to LocalStorage
            const initialAttemptState = { ...initialState.attempt, id: newAttemptId };
            saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

            dispatch({ type: 'RESET_ATTEMPT', payload: { newAttemptId: newAttemptId! } });
        }, [state.attempt.id, topicId, sectionType, quizId, isPreviewMode, userProfile]),

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

                // Call API
                const { score } = await finalizeQuizAttempt({ ...serializableAttempt, timer: state.timer });
                
                // SAVE RESULTS FOR RESULTS PAGE
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