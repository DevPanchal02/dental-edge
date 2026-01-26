import { QuizUIState } from '../../../types/quiz.reducer.types';
import { QuizUIAction } from '../../../types/quiz.reducer.types';

/**
 * Manages the ephemeral UI state (modals, visibility toggles, saving indicators).
 * 
 * @param state - The current UI state slice.
 * @param action - The action to perform.
 * @param currentQuestionIndex - Injected dependency from the Attempt slice. Required for question-specific toggles.
 */
export function uiReducer(state: QuizUIState, action: QuizUIAction, currentQuestionIndex: number): QuizUIState {
    switch (action.type) {
        case 'TOGGLE_EXHIBIT':
            return {
                ...state,
                isExhibitVisible: !state.isExhibitVisible
            };

        case 'TOGGLE_SOLUTION': {
            // Toggles the 'S' solution visibility for the specific question index
            const isCurrentlyRevealed = !!state.tempReveal[currentQuestionIndex];
            return {
                ...state,
                tempReveal: {
                    ...state.tempReveal,
                    [currentQuestionIndex]: !isCurrentlyRevealed
                }
            };
        }

        case 'TOGGLE_EXPLANATION': {
            // Toggles the full explanation visibility for the specific question index
            const isCurrentlyShown = !!state.showExplanation[currentQuestionIndex];
            return {
                ...state,
                showExplanation: {
                    ...state.showExplanation,
                    [currentQuestionIndex]: !isCurrentlyShown
                }
            };
        }

        case 'SET_IS_SAVING':
            return {
                ...state,
                isSaving: action.payload
            };

        // These actions primarily affect root status, but are included here 
        // in case UI cleanup (like closing modals) is required in the future.
        case 'OPEN_REVIEW_SUMMARY':
        case 'CLOSE_REVIEW_SUMMARY':
            return state;

        default:
            return state;
    }
}