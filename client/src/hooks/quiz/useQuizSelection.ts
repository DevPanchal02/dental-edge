import { useCallback } from 'react';
import { QuizState, QuizAction } from './quizReducer';

interface UseQuizSelectionProps {
    state: QuizState;
    dispatch: React.Dispatch<QuizAction>;
    isPreviewMode: boolean;
}

export const useQuizSelection = ({ state, dispatch, isPreviewMode }: UseQuizSelectionProps) => {
    
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
        dispatch({ type: 'TOGGLE_MARK', payload: state.attempt.currentQuestionIndex });
    }, [state.attempt.currentQuestionIndex, isPreviewMode, dispatch]);


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