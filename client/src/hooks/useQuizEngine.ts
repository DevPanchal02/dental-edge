import { useReducer } from 'react';
import { useAuth } from '../context/AuthContext';
import { SectionType } from '../types/content.types';

// Central Logic (Reducer)
import { quizReducer, initialState } from './quiz/quizReducer';

// Decomposed Logic Hooks
import { useQuizInitialization } from './quiz/useQuizInitialization';
import { useQuizNavigation } from './quiz/useQuizNavigation';
import { useQuizSelection } from './quiz/useQuizSelection';
import { useQuizLifecycle } from './quiz/useQuizLifecycle';

export const useQuizEngine = (
    topicId: string, 
    sectionType: SectionType, 
    quizId: string, 
    reviewAttemptId?: string | null, 
    isPreviewMode: boolean = false
) => {
    // 1. Central State Management
    const [state, dispatch] = useReducer(quizReducer, initialState);
    const { userProfile, currentUser } = useAuth();

    // 2. Data Loading & Initialization (Side Effect)
    useQuizInitialization({
        topicId,
        sectionType,
        quizId,
        reviewAttemptId,
        isPreviewMode,
        dispatch,
        currentUser,
        userProfile
    });

    // 3. Navigation Logic (Next, Prev, Jump, Review Summary)
    const navigationActions = useQuizNavigation({
        state,
        dispatch,
        isPreviewMode
    });

    // 4. Selection Logic (Answering, Highlighting, Marking, UI Toggles)
    const selectionActions = useQuizSelection({
        state,
        dispatch,
        isPreviewMode
    });

    // 5. Lifecycle Logic (Persistence, Start, Resume, Finalize)
    const lifecycleActions = useQuizLifecycle({
        state,
        dispatch,
        topicId,
        sectionType,
        quizId,
        userProfile,
        isPreviewMode
    });

    // 6. Unified Public API
    const actions = {
        ...navigationActions,
        ...selectionActions,
        ...lifecycleActions
    };

    return { state, actions };
};