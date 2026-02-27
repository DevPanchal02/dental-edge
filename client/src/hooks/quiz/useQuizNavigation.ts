import { useRef, useEffect, useCallback } from 'react';
import { QuizState, QuizAction } from '../../types/quiz.reducer.types';

interface UseQuizNavigationProps {
    state: QuizState;
    dispatch: React.Dispatch<QuizAction>;
    isPreviewMode: boolean;
}

export const useQuizNavigation = ({ state, dispatch, isPreviewMode }: UseQuizNavigationProps) => {
    // Tracks when the user entered the *current* question (for analytics)
    const questionStartTimeRef = useRef<number | null>(null);
    
    // If the user clicks "Next" twice rapidly, this ref updates instantly
    const pendingIndexRef = useRef<number>(state.attempt.currentQuestionIndex);

    // Sync the pending index whenever the *actual* state settles (navigation completes)
    useEffect(() => {
        if (state.status === 'active') {
            questionStartTimeRef.current = Date.now();
        }
        pendingIndexRef.current = state.attempt.currentQuestionIndex;
    }, [state.status, state.attempt.currentQuestionIndex]);

    /**
     * Executes an action with a 2-second delay if Prometric mode is on.
     * Does NOT block the UI. Allows multiple actions to be queued.
     */
    const executeWithPrometricDelay = useCallback((actionFn: () => void) => {
        const isPrometricEnabled = state.attempt.practiceTestSettings?.prometricDelay;
        
        if (isPrometricEnabled) {
            dispatch({ type: 'SET_PROMETRIC_OVERLAY', payload: true });
            
            setTimeout(() => {
                actionFn();
                // We turn off the overlay flag, but since multiple timers might be running,
                // this is just a state signal. The overlay itself is non-blocking via CSS.
                dispatch({ type: 'SET_PROMETRIC_OVERLAY', payload: false });
            }, 2000);
        } else {
            actionFn();
        }
    }, [state.attempt.practiceTestSettings?.prometricDelay, dispatch]);

    /**
     * Internal helper: Calculates time spent, submits answer, and dispatches navigation.
     * Note: We pass `indexToNavigateTo` explicitly because by the time the delay finishes,
     * `state.attempt.currentQuestionIndex` might be stale in a closure, but the target 
     * was determined at the moment of the click.
     */
    const performNavigation = useCallback((targetIndex: number) => {
        // 1. Calculate Time Spent (approximate based on when we *left* the question)
        const timeNow = Date.now();
        const startTime = questionStartTimeRef.current;
        
        if (startTime) {
            // We use the ref time, but we don't reset it here. 
            // It resets in the useEffect when the state actually updates.
            const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
            
            dispatch({ 
                type: 'UPDATE_TIME_SPENT', 
                payload: { 
                    questionIndex: state.attempt.currentQuestionIndex, 
                    time: elapsedSeconds 
                }
            });
        }
        
        questionStartTimeRef.current = timeNow; // Reset for the next segment
        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        dispatch({ type: 'NAVIGATE_QUESTION', payload: targetIndex });
    }, [state.attempt.currentQuestionIndex, dispatch]);


    // --- Public Actions ---

    const openReviewSummary = useCallback(() => {
        if (isPreviewMode) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }
        
        executeWithPrometricDelay(() => {
            // Finalize time for current question
            const timeNow = Date.now();
            const startTime = questionStartTimeRef.current;
            if (startTime) {
                const elapsedSeconds = Math.round((timeNow - startTime) / 1000);
                dispatch({ 
                    type: 'UPDATE_TIME_SPENT', 
                    payload: { 
                        questionIndex: state.attempt.currentQuestionIndex, 
                        time: elapsedSeconds 
                    }
                });
            }
            questionStartTimeRef.current = null;
            
            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
            dispatch({ type: 'CLEAR_TARGETED_REVIEW' });
            dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
        });
    }, [isPreviewMode, state.attempt.currentQuestionIndex, dispatch, executeWithPrometricDelay]);

    const nextQuestion = useCallback(() => {
        if (isPreviewMode && state.attempt.currentQuestionIndex === 1) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }

        const currentIndexForCalculation = pendingIndexRef.current;
        const targetedSequence = state.uiState.targetedReviewSequence;

        // A. Targeted Review Mode
        if (targetedSequence && targetedSequence.length > 0) {
            const seqIndex = targetedSequence.indexOf(currentIndexForCalculation);
            
            if (seqIndex >= 0 && seqIndex < targetedSequence.length - 1) {
                // Determine next question in sequence
                const nextTarget = targetedSequence[seqIndex + 1];
                
                // Update cursor immediately
                pendingIndexRef.current = nextTarget;
                
                // Schedule navigation
                executeWithPrometricDelay(() => {
                    performNavigation(nextTarget);
                });
            } else {
                // End of sequence -> Go to Summary
                // We don't update pendingIndexRef here as we are leaving the quiz flow
                openReviewSummary();
            }
            return;
        }

        // B. Standard Linear Mode
        const totalQuestions = state.quizContent.questions.length;
        if (currentIndexForCalculation < totalQuestions - 1) {
            const nextTarget = currentIndexForCalculation + 1;
            
            // Update cursor immediately
            pendingIndexRef.current = nextTarget;

            // Schedule navigation
            executeWithPrometricDelay(() => {
                performNavigation(nextTarget);
            });
        }
    }, [state.attempt.currentQuestionIndex, state.quizContent.questions.length, isPreviewMode, state.uiState.targetedReviewSequence, dispatch, performNavigation, executeWithPrometricDelay, openReviewSummary]);

    const previousQuestion = useCallback(() => {
        const currentIndexForCalculation = pendingIndexRef.current;
        const targetedSequence = state.uiState.targetedReviewSequence;

        // A. Targeted Review Mode
        if (targetedSequence && targetedSequence.length > 0) {
            const seqIndex = targetedSequence.indexOf(currentIndexForCalculation);
            
            if (seqIndex > 0) {
                const prevTarget = targetedSequence[seqIndex - 1];
                pendingIndexRef.current = prevTarget;
                
                executeWithPrometricDelay(() => {
                    performNavigation(prevTarget);
                });
            }
            return;
        }

        // B. Standard Linear Mode
        if (currentIndexForCalculation > 0) {
            const prevTarget = currentIndexForCalculation - 1;
            pendingIndexRef.current = prevTarget;

            executeWithPrometricDelay(() => {
                performNavigation(prevTarget);
            });
        }
    }, [state.attempt.currentQuestionIndex, state.uiState.targetedReviewSequence, performNavigation, executeWithPrometricDelay]);

    const jumpToQuestion = useCallback((index: number) => {
        dispatch({ type: 'CLEAR_TARGETED_REVIEW' });
        pendingIndexRef.current = index;
        
        executeWithPrometricDelay(() => {
            performNavigation(index);
            dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
        });
    }, [performNavigation, dispatch, executeWithPrometricDelay]);

    const startTargetedReview = useCallback((indices: number[]) => {
        if (!indices || indices.length === 0) return;
        
        dispatch({ type: 'START_TARGETED_REVIEW', payload: indices });
        pendingIndexRef.current = indices[0];
        
        executeWithPrometricDelay(() => {
            dispatch({ type: 'NAVIGATE_QUESTION', payload: indices[0] });
            dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
        });
    }, [dispatch, executeWithPrometricDelay]);

    return {
        nextQuestion,
        previousQuestion,
        jumpToQuestion,
        openReviewSummary,
        startTargetedReview
    };
};