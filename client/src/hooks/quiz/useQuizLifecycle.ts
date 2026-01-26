import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizState, QuizAction } from '../../types/quiz.reducer.types';
import { Question, QuizResult, PracticeTestSettings } from '../../types/quiz.types';
import { createInitialAttempt } from './quizReducer';
import { 
    saveInProgressAttempt, 
    deleteInProgressAttempt, 
    finalizeQuizAttempt 
} from '../../services/api';
import { 
    getLocalAttemptKey, 
    getResultsKey, 
    saveToLocalStorage, 
    clearLocalStorage, 
    serializeAttemptForApi 
} from './quizStorageUtils';
import { UserProfile } from '../../types/user.types';
import { SectionType } from '../../types/content.types';

interface UseQuizLifecycleProps {
    state: QuizState;
    dispatch: React.Dispatch<QuizAction>;
    topicId: string;
    sectionType: SectionType;
    quizId: string;
    userProfile: UserProfile | null;
    isPreviewMode: boolean;
}

export const useQuizLifecycle = ({
    state,
    dispatch,
    topicId,
    sectionType,
    quizId,
    userProfile,
    isPreviewMode
}: UseQuizLifecycleProps) => {
    
    const navigate = useNavigate();

    // --- Persistence ---

    const saveProgress = useCallback(async (currentTimerValue: number) => {
        const isFreeUser = userProfile?.tier === 'free';
        
        // Don't save if preview, free user, or no attempt ID
        if (isPreviewMode || isFreeUser || !state.attempt.id) return;

        dispatch({ type: 'SET_IS_SAVING', payload: true });
        
        // Update the snapshot with the current timer value provided by the UI component
        // Note: The reducer state uses 'timerSnapshot', but API/Storage expects 'timer'
        const timerData = { 
            ...state.timerSnapshot, 
            value: currentTimerValue
        };

        // Serialize Sets to Arrays for storage
        const serializableAttempt = serializeAttemptForApi(state.attempt);
        
        const fullDataToSave = { 
            ...serializableAttempt, 
            timer: timerData 
        };

        // 1. Local Storage (Sync)
        const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
        saveToLocalStorage(localKey, fullDataToSave);

        // 2. Server (Async)
        try {
            // We cast fullDataToSave because the API expects a partial QuizAttempt which includes 'timer'
            await saveInProgressAttempt(fullDataToSave);
        } catch (e) {
            console.error("Auto-save failed", e);
        } finally {
            // Add a small delay so the user sees "Saving..." briefly
            setTimeout(() => dispatch({ type: 'SET_IS_SAVING', payload: false }), 500);
        }

    }, [state.attempt, state.timerSnapshot, isPreviewMode, userProfile, topicId, sectionType, quizId, dispatch]);

    // --- Lifecycle Actions ---

    const resumeAttempt = useCallback(() => {
        dispatch({ type: 'RESUME_ATTEMPT' });
    }, [dispatch]);

    const startAttemptWithOptions = useCallback(async (settings: PracticeTestSettings) => {
        const baseMinutes = 180; // Standard DAT time
        const modifier = settings.additionalTime ? 1.5 : 1.0;
        const durationSeconds = Math.round(baseMinutes * 60 * modifier);

        if (isPreviewMode) {
            dispatch({ type: 'START_PREVIEW', payload: { settings, duration: durationSeconds } });
            return;
        }

        const isFreeUser = userProfile?.tier === 'free';
        const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
        
        // Create initial timer configuration
        const timerData = { value: durationSeconds, isCountdown: true, initialDuration: durationSeconds };
        
        let attemptId: string | undefined;

        if (isFreeUser) {
            attemptId = `local-${Date.now()}`;
        } else {
            try {
                // Initialize empty attempt on server
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
            
            // Save initial state
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
    }, [isPreviewMode, topicId, sectionType, quizId, userProfile, state.quizContent, dispatch]);

    const startNewAttempt = useCallback(async () => {
        if (isPreviewMode) return;

        const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
        clearLocalStorage(localKey);
        
        const isFreeUser = userProfile?.tier === 'free';

        // Clean up old server attempt if it exists
        if (state.attempt.id && !isFreeUser) {
            await deleteInProgressAttempt(state.attempt.id);
        }
        
        // Branch logic: Practice Test needs options; QBank starts immediately
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
    }, [state.attempt.id, topicId, sectionType, quizId, isPreviewMode, userProfile, state.quizContent, sectionType, dispatch]);

    const finalizeAttempt = useCallback(async (finalTimerValue: number) => {
        if (isPreviewMode) {
            navigate('/');
            return;
        }

        try {
            const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
            const resultsKey = getResultsKey(topicId, sectionType, quizId);

            dispatch({ type: 'SET_IS_SAVING', payload: true });

            const serializableAttempt = serializeAttemptForApi(state.attempt);
            const timerData = { ...state.timerSnapshot, value: finalTimerValue };

            // Server-side calculation and storage
            const { score } = await finalizeQuizAttempt({ ...serializableAttempt, timer: timerData });
            
            // Client-side result generation for immediate display
            const results: QuizResult = {
                score,
                totalQuestions: state.quizContent.questions.length,
                totalValidQuestions: state.quizContent.questions.length,
                userAnswers: state.attempt.userAnswers,
                timestamp: Date.now(),
                quizName: state.quizContent.metadata?.fullNameForDisplay,
                correctIndices: [],
                incorrectIndices: []
            };
            
            // Calculate indices for review
            state.quizContent.questions.forEach((q: Question, idx: number) => {
                const correctOpt = q.options.find(o => o.is_correct);
                if (correctOpt && state.attempt.userAnswers[idx] === correctOpt.label) {
                    results.correctIndices.push(idx);
                } else {
                    results.incorrectIndices.push(idx);
                }
            });

            // Save results locally for the ResultsPage to pick up
            saveToLocalStorage(resultsKey, results);
            clearLocalStorage(localKey);
            
            dispatch({ type: 'FINALIZE_SUCCESS', payload: { attemptId: state.attempt.id } });
            navigate(`/app/results/${topicId}/${sectionType}/${quizId}`, { replace: true });

        } catch (error) {
            dispatch({ type: 'SET_ERROR', payload: error });
        }
    }, [state.attempt, state.timerSnapshot, state.quizContent, topicId, sectionType, quizId, navigate, isPreviewMode, dispatch]);

    return {
        saveProgress,
        resumeAttempt,
        startAttemptWithOptions,
        startNewAttempt,
        finalizeAttempt
    };
};