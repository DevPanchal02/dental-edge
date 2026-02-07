import { QuizAttemptState } from '../../../types/quiz.types';
import { QuizAttemptAction } from '../../../types/quiz.reducer.types';

/**
 * Manages the User's specific attempt data (answers, marks, time).
 * This reducer corresponds strictly to the 'attempt' slice of the state.
 */
export function attemptReducer(state: QuizAttemptState, action: QuizAttemptAction): QuizAttemptState {
    switch (action.type) {
        case 'SELECT_OPTION': {
            const { questionIndex, optionLabel } = action.payload;
            
            // Prevent mutation of the nested object
            const newUserAnswers = { ...state.userAnswers };
            
            // If the user selects an option, we record it.
            // Note: Validationd should be handled before dispatching or by UI guards.
            newUserAnswers[questionIndex] = optionLabel;

            const newCrossedOff = { ...state.crossedOffOptions };
            if (newCrossedOff[questionIndex]?.has(optionLabel)) {
                const setCopy = new Set(newCrossedOff[questionIndex]);
                setCopy.delete(optionLabel);
                newCrossedOff[questionIndex] = setCopy;
            }

            return {
                ...state,
                userAnswers: newUserAnswers,
                crossedOffOptions: newCrossedOff
            };
        }

        case 'TOGGLE_CROSS_OFF': {
            const { questionIndex, optionLabel } = action.payload;
            const newCrossedOff = { ...state.crossedOffOptions };
            
            // Ensure Set exists for this index before modification
            const currentSet = newCrossedOff[questionIndex] 
                ? new Set(newCrossedOff[questionIndex]) 
                : new Set<string>();

            if (currentSet.has(optionLabel)) {
                currentSet.delete(optionLabel);
            } else {
                currentSet.add(optionLabel);
            }
            newCrossedOff[questionIndex] = currentSet;

            //If user crosses off their currently selected answer, deselect it
            const newAnswers = { ...state.userAnswers };
            if (currentSet.has(newAnswers[questionIndex])) {
                delete newAnswers[questionIndex];
            }

            return {
                ...state,
                userAnswers: newAnswers,
                crossedOffOptions: newCrossedOff,
            };
        }

        case 'TOGGLE_MARK': {
            const { payload: questionIndex } = action;
            const newMarked = { ...state.markedQuestions };
            
            if (newMarked[questionIndex]) {
                delete newMarked[questionIndex];
            } else {
                newMarked[questionIndex] = true;
            }
            
            return {
                ...state,
                markedQuestions: newMarked
            };
        }

        case 'NAVIGATE_QUESTION': {
            return {
                ...state,
                currentQuestionIndex: action.payload,
            };
        }

        case 'SUBMIT_CURRENT_ANSWER': {
            const currentIndex = state.currentQuestionIndex;
            // Only mark as submitted if there is actually an answer selected
            if (state.userAnswers[currentIndex]) {
                return {
                    ...state,
                    submittedAnswers: {
                        ...state.submittedAnswers,
                        [currentIndex]: true,
                    },
                };
            }
            return state;
        }

        case 'UPDATE_TIME_SPENT': {
            const { questionIndex, time } = action.payload;
            const existingTime = state.userTimeSpent[questionIndex] || 0;
            return {
                ...state,
                userTimeSpent: {
                    ...state.userTimeSpent,
                    [questionIndex]: existingTime + time,
                },
            };
        }

        case 'UPDATE_HIGHLIGHT': {
            const { contentKey, html } = action.payload;
            return {
                ...state,
                highlightedHtml: {
                    ...state.highlightedHtml,
                    [contentKey]: html
                }
            };
        }

        default:
            return state;
    }
}