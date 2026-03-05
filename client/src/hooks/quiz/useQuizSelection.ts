import { useCallback } from 'react';
import { QuizState, QuizAction } from '../../types/quiz.reducer.types';

interface UseQuizSelectionProps {
    state: QuizState;
    dispatch: React.Dispatch<QuizAction>;
    isPreviewMode: boolean;
}

export const useQuizSelection = ({ state, dispatch, isPreviewMode }: UseQuizSelectionProps) => {
    
    // Non-blocking Prometric delay handler for selection buttons
    const executeWithPrometricDelay = useCallback((actionFn: () => void) => {
        const isPrometricEnabled = state.attempt.practiceTestSettings?.prometricDelay;
        
        if (isPrometricEnabled) {
            //the delay happens via setTimeout without blocking the thread.
            dispatch({ type: 'SET_PROMETRIC_OVERLAY', payload: true });
            setTimeout(() => {
                actionFn();
                dispatch({ type: 'SET_PROMETRIC_OVERLAY', payload: false });
            }, 2000);
        } else {
            actionFn();
        }
    }, [state.attempt.practiceTestSettings?.prometricDelay, dispatch]);


    // --- Answer & Annotation Logic ---

    const selectOption = useCallback((questionIndex: number, optionLabel: string) => 
        dispatch({ type: 'SELECT_OPTION', payload: { questionIndex, optionLabel } }), 
    [dispatch]);
        
    const toggleCrossOff = useCallback((questionIndex: number, optionLabel: string) => 
        dispatch({ type: 'TOGGLE_CROSS_OFF', payload: { questionIndex, optionLabel } }), 
    [dispatch]);

    const updateHighlight = useCallback((contentKey: string, html: string) => 
        dispatch({ type: 'UPDATE_HIGHLIGHT', payload: { contentKey, html } }), 
    [dispatch]);

    const toggleMark = useCallback(() => {
        if (isPreviewMode) return;

        // We capture the CURRENT index here 
        // If the user navigates away before this fires, it marks the question they were looking at when they clicked.
        const indexToMark = state.attempt.currentQuestionIndex;
        
        executeWithPrometricDelay(() => {
            dispatch({ type: 'TOGGLE_MARK', payload: indexToMark });
        });
    }, [state.attempt.currentQuestionIndex, isPreviewMode, dispatch, executeWithPrometricDelay]);


    // --- UI Visibility Toggles ---

    const toggleExhibit = useCallback(() => 
        dispatch({ type: 'TOGGLE_EXHIBIT' }), 
    [dispatch]);

    const toggleSolution = useCallback(() => 
        dispatch({ type: 'TOGGLE_SOLUTION' }), 
    [dispatch]);

    const toggleExplanation = useCallback(() => 
        dispatch({ type: 'TOGGLE_EXPLANATION' }), 
    [dispatch]);
    
    const closeReviewSummary = useCallback(() => 
        dispatch({ type: 'CLOSE_REVIEW_SUMMARY' }), 
    [dispatch]);

    const closeRegistrationPrompt = useCallback(() => 
        dispatch({ type: 'CLOSE_REGISTRATION_PROMPT' }), 
    [dispatch]);

    return {
        selectOption,
        toggleCrossOff,
        updateHighlight,
        toggleMark,
        toggleExhibit,
        toggleSolution,
        toggleExplanation,
        closeReviewSummary,
        closeRegistrationPrompt
    };
};