import { useEffect, useRef } from 'react';
import { QuizAction } from '../../types/quiz.reducer.types';
import { QuizAttempt, QuizAttemptState, QuizIdentifiers } from '../../types/quiz.types';
import { SectionType } from '../../types/content.types';
import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt, getQuizAttemptById } from '../../services/api';
import { UserProfile } from '../../types/user.types';
import { getLocalAttemptKey, loadFromLocalStorage, saveToLocalStorage } from './quizStorageUtils';
import { initialState, createInitialAttempt } from './quizReducer';

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

/**
 * Helper to convert Serialized Data (Arrays) -> Runtime State (Sets).
 * Handles data from API (JSON) or LocalStorage.
 */
const deserializeAttempt = (data: QuizAttempt | Partial<QuizAttempt>): Partial<QuizAttemptState> => {
    // 1. Extract crossedOffOptions to handle separately
    const { crossedOffOptions, ...rest } = data;
    
    // 2. Convert Record<string, string[]> -> Record<number, Set<string>>
    let convertedCrossedOff: Record<number, Set<string>> = {};

    if (crossedOffOptions) {
        convertedCrossedOff = Object.fromEntries(
            Object.entries(crossedOffOptions).map(([key, value]) => {
                // Ensure value is treated as an iterable array before making a Set
                const valueAsArray = Array.isArray(value) ? value : [];
                return [Number(key), new Set(valueAsArray)];
            })
        );
    }

    // 3. Return the State-compatible object
    return {
        ...rest,
        // Ensure we cast to the correct type for the Reducer
        crossedOffOptions: convertedCrossedOff
    } as Partial<QuizAttemptState>;
};

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
            // Construct QuizIdentifiers payload
            const identifiers: QuizIdentifiers = { 
                topicId, 
                sectionType, 
                quizId, 
                reviewAttemptId, 
                isPreviewMode 
            };

            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: identifiers });
            
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
                    dispatch({ type: 'PROMPT_OPTIONS', payload: { questions, metadata: previewMetadata } });
                    return;
                }
                
                if (!currentUser) return;

                // Case 2: Review Mode (Past Attempt)
                if (reviewAttemptId) {
                    const rawReviewData = await getQuizAttemptById(reviewAttemptId);
                    const stateReadyReviewData = deserializeAttempt(rawReviewData);
                    
                    dispatch({ type: 'PROMPT_RESUME', payload: { attempt: stateReadyReviewData, questions, metadata } });
                    dispatch({ type: 'RESUME_ATTEMPT' }); 
                    return;
                } 

                // Case 3: Active/New Attempt
                const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                
                // Load and deserialize local data
                const rawLocalData = loadFromLocalStorage<QuizAttempt>(localKey);
                let inProgressAttempt = rawLocalData ? deserializeAttempt(rawLocalData) : null;
                
                const isFreeUser = userProfile?.tier === 'free';

                // If Paid User and no local data, check Server
                if (!inProgressAttempt && !isFreeUser) {
                    const rawServerAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    if (rawServerAttempt) {
                        inProgressAttempt = deserializeAttempt(rawServerAttempt);
                    }
                }

                if (inProgressAttempt) {
                    dispatch({ type: 'PROMPT_RESUME', payload: { attempt: inProgressAttempt, questions, metadata } });
                } else {
                    // Logic: Branch based on Section Type
                    
                    // If it's a Practice Test, show options modal first
                    if (sectionType === 'practice') {
                        dispatch({ type: 'PROMPT_OPTIONS', payload: { questions, metadata } });
                        return;
                    }

                    // If it's a Question Bank, create attempt immediately (Standard Mode)
                    let attemptId: string | undefined;
                    
                    // Use the snapshot from initialState
                    const timerData = initialState.timerSnapshot;

                    if (isFreeUser) {
                        attemptId = `local-${Date.now()}`;
                    } else {
                        attemptId = await saveInProgressAttempt({ 
                            topicId, 
                            sectionType, 
                            quizId, 
                            status: 'active',
                            userAnswers: {},
                            markedQuestions: {},
                            crossedOffOptions: {}, 
                            userTimeSpent: {},
                            currentQuestionIndex: 0,
                            timer: timerData
                        });
                    }

                    if (!attemptId) throw new Error("Failed to create attempt ID");

                    // Save initial state to local storage
                    const initialAttemptState = { ...createInitialAttempt(topicId, sectionType, quizId), id: attemptId };
                    
                    // Note: We map 'timerSnapshot' to 'timer' to match the QuizAttempt storage schema
                    saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

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