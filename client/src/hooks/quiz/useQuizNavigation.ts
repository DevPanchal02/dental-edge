import { useRef, useEffect, useCallback } from 'react';
import { QuizState, QuizAction } from '../../types/quiz.reducer.types';

interface UseQuizNavigationProps {
    state: QuizState;
    dispatch: React.Dispatch<QuizAction>;
    isPreviewMode: boolean;
}

export const useQuizNavigation = ({ state, dispatch, isPreviewMode }: UseQuizNavigationProps) => {
    // This ref tracks when the user started looking at the current question.
    // We use a ref so it doesn't trigger re-renders, but persists across renders.
    const questionStartTimeRef = useRef<number | null>(null);

    // Effect: Reset the start time whenever the question index changes or the quiz becomes active.
    useEffect(() => {
        if (state.status === 'active') {
            questionStartTimeRef.current = Date.now();
        }
    }, [state.status, state.attempt.currentQuestionIndex]);

    /**
     * Internal helper: Calculates time spent on the current question, 
     * submits the current answer (if any), and moves to the target index.
     */
    const recordTimeAndNavigate = useCallback((newIndex: number) => {
        const totalQuestions = state.quizContent.questions.length;
        
        // Boundary check
        if (newIndex >= 0 && newIndex < totalQuestions) {
            // 1. Calculate Time Spent
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
            
            // Reset start time for the next question
            questionStartTimeRef.current = timeNow;

            // 2. Lock in the answer (Visual state update)
            dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });

            // 3. Move
            dispatch({ type: 'NAVIGATE_QUESTION', payload: newIndex });
        }
    }, [
        state.quizContent.questions.length, 
        state.attempt.currentQuestionIndex, 
        dispatch
    ]);

    // --- Public Actions ---

    const nextQuestion = useCallback(() => {
        // Gate: In Preview Mode, block navigation after Question 2 (Index 1)
        if (isPreviewMode && state.attempt.currentQuestionIndex === 1) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }
        recordTimeAndNavigate(state.attempt.currentQuestionIndex + 1);
    }, [state.attempt.currentQuestionIndex, isPreviewMode, dispatch, recordTimeAndNavigate]);

    const previousQuestion = useCallback(() => {
        recordTimeAndNavigate(state.attempt.currentQuestionIndex - 1);
    }, [state.attempt.currentQuestionIndex, recordTimeAndNavigate]);

    const jumpToQuestion = useCallback((index: number) => {
        recordTimeAndNavigate(index);
        dispatch({ type: 'CLOSE_REVIEW_SUMMARY' });
    }, [recordTimeAndNavigate, dispatch]);

    const openReviewSummary = useCallback(() => {
        if (isPreviewMode) {
            dispatch({ type: 'PROMPT_REGISTRATION' });
            return;
        }
        
        // We must also record time when leaving the quiz flow to go to the summary
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
        questionStartTimeRef.current = null; // Clear it so we don't double count if they resume
        
        dispatch({ type: 'SUBMIT_CURRENT_ANSWER' });
        dispatch({ type: 'OPEN_REVIEW_SUMMARY' });
    }, [isPreviewMode, state.attempt.currentQuestionIndex, dispatch]);

    return {
        nextQuestion,
        previousQuestion,
        jumpToQuestion,
        openReviewSummary
    };
};