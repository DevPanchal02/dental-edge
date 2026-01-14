import { useEffect, useRef } from 'react';
import { QuizAction } from './quizReducer';
import { SectionType } from '../../types/content.types';
import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt, getQuizAttemptById } from '../../services/api';
import { UserProfile } from '../../types/user.types';
import { getLocalAttemptKey, loadFromLocalStorage, saveToLocalStorage } from './quizStorageUtils';
import { initialState } from './quizReducer';

interface UseQuizInitializationProps {
    topicId: string;
    sectionType: SectionType;
    quizId: string;
    reviewAttemptId?: string | null;
    isPreviewMode: boolean;
    dispatch: React.Dispatch<QuizAction>;
    currentUser: any;
    userProfile: UserProfile | null;
}

export const useQuizInitialization = ({
    topicId,
    sectionType,
    quizId,
    reviewAttemptId,
    isPreviewMode,
    dispatch,
    currentUser,
    userProfile
}: UseQuizInitializationProps) => {
    
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const initialize = async () => {
            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: { topicId, sectionType, quizId, reviewAttemptId, isPreviewMode } });
            
            try {
                // Fetch data
                const fetchData = Promise.all([
                    getQuizData(topicId, sectionType, quizId, isPreviewMode),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);

                // Timeout safety
                const timeout = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 15000)
                );

                const [questions, metadata] = await Promise.race([fetchData, timeout]);

                if (!metadata) throw new Error("Quiz metadata not found.");

                // Case 1: Preview Mode (Guest)
                if (isPreviewMode) {
                    const previewMetadata = {
                        ...metadata,
                        fullNameForDisplay: 'Dental Aptitude Test 1',
                        categoryForInstructions: 'DAT',
                    };
                    dispatch({ type: 'PROMPT_PREVIEW_OPTIONS', payload: { questions, metadata: previewMetadata } });
                    return;
                }
                
                if (!currentUser) return;

                // Case 2: Review Mode (Past Attempt)
                if (reviewAttemptId) {
                    const reviewData = await getQuizAttemptById(reviewAttemptId);
                    
                    // Deserialize crossedOffOptions (Arrays -> Sets)
                    if (reviewData.crossedOffOptions && !Array.isArray(reviewData.crossedOffOptions)) {
                         const convertedReviewData = {
                             ...reviewData,
                             crossedOffOptions: Object.fromEntries(
                                Object.entries(reviewData.crossedOffOptions).map(([k, v]) => [k, new Set(v as string[])])
                             )
                         };
                         dispatch({ type: 'PROMPT_RESUME', payload: { attempt: convertedReviewData, questions, metadata } });
                    } else {
                        dispatch({ type: 'PROMPT_RESUME', payload: { attempt: reviewData, questions, metadata } });
                    }
                    
                    dispatch({ type: 'RESUME_ATTEMPT' }); 
                    return;
                } 

                // Case 3: Active/New Attempt
                const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                let inProgressAttempt = loadFromLocalStorage(localKey);
                const isFreeUser = userProfile?.tier === 'free';

                // If Paid User and no local data, check Server
                if (!inProgressAttempt && !isFreeUser) {
                    const serverAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    if (serverAttempt) {
                        // Deserialize Arrays -> Sets
                        inProgressAttempt = {
                            ...serverAttempt,
                            crossedOffOptions: Object.fromEntries(
                                Object.entries(serverAttempt.crossedOffOptions).map(([k, v]) => [k, new Set(v as string[])])
                            )
                        };
                    }
                }

                if (inProgressAttempt) {
                    dispatch({ type: 'PROMPT_RESUME', payload: { attempt: inProgressAttempt, questions, metadata } });
                } else {
                    // Create New
                    let attemptId: string | undefined;
                    
                    if (isFreeUser) {
                        attemptId = `local-${Date.now()}`;
                    } else {
                         // Default timer state for new attempt
                        const timerData = { value: 0, isActive: false, isCountdown: false, initialDuration: 0 };
                        attemptId = await saveInProgressAttempt({ 
                            topicId, 
                            sectionType, 
                            quizId, 
                            status: 'active',
                            userAnswers: {},
                            markedQuestions: {},
                            crossedOffOptions: {}, // Send empty object
                            userTimeSpent: {},
                            currentQuestionIndex: 0,
                            timer: timerData
                        });
                    }

                    if (!attemptId) throw new Error("Failed to create attempt ID");

                    // Save initial state to local storage
                    const initialAttemptState = { ...initialState.attempt, id: attemptId };
                    saveToLocalStorage(localKey, { ...initialAttemptState, timer: initialState.timer });

                    dispatch({ type: 'SET_DATA_AND_START', payload: { questions, metadata, attemptId } });
                }
                
            } catch (error) {
                console.error("Initialization Error:", error);
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        };

        initialize();

    }, [topicId, sectionType, quizId, reviewAttemptId, currentUser, isPreviewMode, userProfile, dispatch]);
};