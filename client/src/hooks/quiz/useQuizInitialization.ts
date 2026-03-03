import { useEffect, useRef } from 'react';
import { QuizAction } from '../../types/quiz.reducer.types';
import { QuizAttempt, QuizAttemptState, QuizIdentifiers, QuizResult } from '../../types/quiz.types';
import { SectionType } from '../../types/content.types';
import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt, getQuizAttemptById } from '../../services/api';
import { UserProfile } from '../../types/user.types';
import { getLocalAttemptKey, getResultsKey, loadFromLocalStorage, saveToLocalStorage } from './quizStorageUtils';
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

const deserializeAttempt = (data: QuizAttempt | Partial<QuizAttempt>): Partial<QuizAttemptState> => {
    const { crossedOffOptions, ...rest } = data;
    let convertedCrossedOff: Record<number, Set<string>> = {};

    if (crossedOffOptions) {
        convertedCrossedOff = Object.fromEntries(
            Object.entries(crossedOffOptions).map(([key, value]) => {
                const valueAsArray = Array.isArray(value) ? value : [];
                return [Number(key), new Set(valueAsArray)];
            })
        );
    }

    return {
        ...rest,
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
            const identifiers: QuizIdentifiers = { 
                topicId, 
                sectionType, 
                quizId, 
                reviewAttemptId, 
                isPreviewMode 
            };

            dispatch({ type: 'INITIALIZE_ATTEMPT', payload: identifiers });
            
            try {
                const fetchData = Promise.all([
                    getQuizData(topicId, sectionType, quizId, isPreviewMode),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);

                const timeout = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 15000)
                );

                const [questions, metadata] = await Promise.race([fetchData, timeout]);

                if (!metadata) throw new Error("Quiz metadata not found.");

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

                // --- REVIEW MODE LOGIC ---
                if (reviewAttemptId) {
                    // Scenario A: Local Result Review (Free Tier / Unsynced)
                    if (reviewAttemptId === 'local-preview') {
                        const resultsKey = getResultsKey(topicId, sectionType, quizId);
                        const localResult = loadFromLocalStorage<QuizResult>(resultsKey);
                        
                        if (localResult) {
                            const mockReviewData: Partial<QuizAttemptState> = {
                                id: 'local-preview',
                                topicId,
                                sectionType,
                                quizId,
                                userAnswers: localResult.userAnswers,
                                markedQuestions: {},
                                crossedOffOptions: {},
                                userTimeSpent: {}, // Local results might not save detailed time per question, so default empty
                                currentQuestionIndex: 0,
                                status: 'completed',
                                timer: { value: 0, isCountdown: false, initialDuration: 0 }
                            };
                            
                            dispatch({ type: 'PROMPT_RESUME', payload: { attempt: mockReviewData, questions, metadata } });
                            // FIX: Force the reducer to enter Review Mode explicitly
                            // @ts-expect-error - Custom payload property handled in reducer
                            dispatch({ type: 'RESUME_ATTEMPT', payload: { forceReviewMode: true } }); 
                            return;
                        } else {
                            throw new Error("Local results not found.");
                        }
                    } else {
                        // Scenario B: Backend Result Review (Pro Tier)
                        const rawReviewData = await getQuizAttemptById(reviewAttemptId);
                        const stateReadyReviewData = deserializeAttempt(rawReviewData);
                        
                        dispatch({ type: 'PROMPT_RESUME', payload: { attempt: stateReadyReviewData, questions, metadata } });
                        // FIX: Force the reducer to enter Review Mode explicitly
                        // @ts-expect-error - Custom payload property handled in reducer
                        dispatch({ type: 'RESUME_ATTEMPT', payload: { forceReviewMode: true } }); 
                        return;
                    }
                } 

                // --- ACTIVE ATTEMPT LOGIC ---
                const localKey = getLocalAttemptKey(topicId, sectionType, quizId);
                const rawLocalData = loadFromLocalStorage<QuizAttempt>(localKey);
                let inProgressAttempt = rawLocalData ? deserializeAttempt(rawLocalData) : null;
                
                const isFreeUser = userProfile?.tier === 'free';

                if (!inProgressAttempt && !isFreeUser) {
                    const rawServerAttempt = await getInProgressAttempt({ topicId, sectionType, quizId });
                    if (rawServerAttempt) {
                        inProgressAttempt = deserializeAttempt(rawServerAttempt);
                    }
                }

                if (inProgressAttempt) {
                    dispatch({ type: 'PROMPT_RESUME', payload: { attempt: inProgressAttempt, questions, metadata } });
                } else {
                    if (sectionType === 'practice') {
                        dispatch({ type: 'PROMPT_OPTIONS', payload: { questions, metadata } });
                        return;
                    }

                    const timerData = initialState.timerSnapshot;
                    let attemptId: string | undefined;

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

                    const initialAttemptState = { ...createInitialAttempt(topicId, sectionType, quizId), id: attemptId };
                    saveToLocalStorage(localKey, { ...initialAttemptState, timer: timerData });

                    dispatch({ type: 'SET_DATA_AND_START', payload: { questions, metadata, attemptId } });
                }
                
            } catch (error) {
                console.error("Initialization Error:", error);
                dispatch({ type: 'SET_ERROR', payload: error });
            }
        };

        initialize();

    },[topicId, sectionType, quizId, reviewAttemptId, currentUser, isPreviewMode, userProfile, dispatch]);
};