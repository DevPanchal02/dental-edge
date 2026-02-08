import React, { useMemo, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { QuizTimerProvider, useQuizTimer } from '../context/QuizTimerContext';
import { QuizProvider } from '../context/QuizContext';
import { formatDisplayName } from '../services/loader';

import QuizHeader from '../components/quiz/QuizHeader';
import QuizFooter from '../components/quiz/QuizFooter';
import QuizContentArea from '../components/quiz/QuizContentArea';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import ResumePromptModal from '../components/ResumePromptModal';
import QuizReviewSummary from '../components/QuizReviewSummary';
import PracticeTestOptions from '../components/PracticeTestOptions';
import RegistrationPromptModal from '../components/RegistrationPromptModal';
import Exhibit from '../components/Exhibit';
import TextHighlighterWrapper from '../components/TextHighlighterWrapper';
import QuizPersistence from '../components/quiz/QuizPersistence';

import { SectionType } from '../types/content.types';
import { QuizStatus } from '../types/quiz.types';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Headless Component: QuizTimerSync
 * 
 * Synchronizes the Domain State (QuizEngine) with the UI State (QuizTimerContext).
 * This ensures the timer starts/stops precisely when the quiz status transitions.
 */
interface QuizTimerSyncProps {
    status: QuizStatus;
    timerValue: number;
    initialDuration: number;
    isCountdown: boolean;
}

const QuizTimerSync: React.FC<QuizTimerSyncProps> = ({ 
    status, 
    timerValue, 
    initialDuration, 
    isCountdown 
}) => {
    const { initializeTimer, startTimer, stopTimer, syncTimer } = useQuizTimer();
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Only initialize once per quiz mount to prevent timer resets on re-renders
        if ((status === 'active' || status === 'reviewing_attempt') && !hasInitialized.current) {
            const mode = isCountdown ? 'countdown' : 'countup';
            initializeTimer(initialDuration, mode);
            
            if (isCountdown) {
                syncTimer(timerValue, initialDuration - timerValue);
            } else {
                syncTimer(initialDuration - timerValue, timerValue);
            }
            
            if (status === 'active') startTimer();
            hasInitialized.current = true;
        }

        // Cleanup: Stop the clock if the quiz hits a terminal or error state
        if (status === 'completed' || status === 'error') {
            stopTimer();
        }
    }, [status, timerValue, initialDuration, isCountdown, initializeTimer, startTimer, stopTimer, syncTimer]);

    return null;
};

interface QuizPageProps {
    isPreviewMode?: boolean;
}

/**
 * QuizPage: The root container for the testing experience.
 */
const QuizPage: React.FC<QuizPageProps> = ({ isPreviewMode = false }) => {
    const { topicId = '', sectionType = 'practice', quizId = '' } = useParams<{ 
        topicId: string; 
        sectionType: string; 
        quizId: string; 
    }>();
    
    const location = useLocation();
    const navigate = useNavigate();

    // Extract attempt ID if navigating to a specific review session
    const reviewAttemptId = (location.state as { attemptId?: string } | null)?.attemptId;

    // The Engine handles all business logic, networking, and state transitions
    const quizEngine = useQuizEngine(
        topicId, 
        sectionType as SectionType, 
        quizId, 
        reviewAttemptId, 
        isPreviewMode
    );
    const { state, actions } = quizEngine;
    
    const { isSidebarEffectivelyPinned } = useLayout();

    // UI Configuration: Memoized to prevent unnecessary re-calculations
    const uiProps = useMemo(() => {
        const isReviewing = state.status === 'reviewing_attempt';
        const currentIndex = state.attempt.currentQuestionIndex;
        // In preview mode, we show a fake high number to simulate the real DAT scale
        const displayQuestionCount = isPreviewMode ? 210 : state.quizContent.questions.length;

        return {
            containerStyle: {
                marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
                paddingBottom: '90px',
            } as React.CSSProperties,
            
            footerStyle: {
                left: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
            } as React.CSSProperties,
            
            headerProps: {
                title: state.quizContent.metadata?.fullNameForDisplay || 'Loading Quiz...',
                progressText: `Question ${currentIndex + 1} of ${displayQuestionCount}`,
                backLink: isReviewing ? `/app/results/${topicId}/${sectionType}/${quizId}` : `/app/topic/${topicId}`,
                backText: isReviewing ? 'Back to Results' : `Back to ${state.quizContent.metadata?.topicName || formatDisplayName(topicId)}`,
                isPreviewMode: isPreviewMode,
            },
            
            showExhibitButton: topicId === 'chemistry',
            showSolutionButton: state.quizIdentifiers?.sectionType === 'qbank',
        };
    }, [
        state.status, 
        state.attempt.currentQuestionIndex, 
        state.quizContent.questions.length, 
        state.quizContent.metadata, 
        state.quizIdentifiers, 
        isSidebarEffectivelyPinned, 
        topicId, 
        sectionType, 
        quizId, 
        isPreviewMode
    ]);

    // --- VIEW STATES ---

    if (state.status === 'initializing' || state.status === 'loading') {
        return <LoadingSpinner message="Loading Quiz..." />;
    }

    if (state.status === 'error') {
        return <ErrorDisplay 
            error={getErrorMessage(state.error, 'An unknown error occurred.')} 
            backLink={isPreviewMode ? '/' : `/app/topic/${topicId}`} 
            backLinkText={isPreviewMode ? 'Back to Home' : 'Back to Topic'} 
        />;
    }
    
    // --- MODAL STATES ---
    
    if (state.status === 'prompting_options') {
        return (
            <PracticeTestOptions
                isOpen={true}
                onClose={() => navigate('/')}
                onStartTest={actions.startAttemptWithOptions}
                fullNameForDisplay={state.quizContent.metadata?.fullNameForDisplay}
                categoryForInstructions={state.quizContent.metadata?.categoryForInstructions}
                baseTimeLimitMinutes={180}
                numQuestions={210} 
            />
        );
    }
    
    if (state.status === 'prompting_registration') {
        return <RegistrationPromptModal isOpen={true} onClose={actions.closeRegistrationPrompt} />;
    }

    if (state.status === 'prompting_resume' && !isPreviewMode) {
        return (
            <ResumePromptModal
                onResume={actions.resumeAttempt}
                onStartNew={actions.startNewAttempt}
            />
        );
    }
    
    // --- MAIN APPLICATION VIEW ---

    return (
        <QuizProvider value={quizEngine}>
            <QuizTimerProvider>
                {/* Side-Effect: Bridge Engine State to Timer Context */}
                <QuizTimerSync 
                    status={state.status}
                    timerValue={state.timerSnapshot.value}
                    initialDuration={state.timerSnapshot.initialDuration}
                    isCountdown={state.timerSnapshot.isCountdown}
                />

                {/* Side-Effect: Heartbeat to persist timer to DB */}
                <QuizPersistence />

                <TextHighlighterWrapper
                    className={`quiz-page-container ${isPreviewMode ? 'preview-mode' : ''}`}
                    onHighlightUpdate={actions.updateHighlight}
                    isEnabled={!state.uiState.isSaving && !state.uiState.isNavActionInProgress}
                >
                    <div style={uiProps.containerStyle}>
                        
                        {state.status === 'reviewing_summary' ? (
                            <QuizReviewSummary
                                allQuizQuestions={state.quizContent.questions}
                                quizMetadata={state.quizContent.metadata}
                                markedQuestions={state.attempt.markedQuestions}
                                submittedAnswers={state.attempt.submittedAnswers || {}}
                                userAnswers={state.attempt.userAnswers}
                                currentQuestionIndexBeforeReview={state.attempt.currentQuestionIndex}
                                topicId={topicId}
                                onCloseReviewSummary={actions.closeReviewSummary}
                                onJumpToQuestionInQuiz={actions.jumpToQuestion}
                                onEndQuiz={actions.finalizeAttempt}
                                dynamicFooterStyle={uiProps.footerStyle}
                                isNavActionInProgress={state.uiState.isSaving}
                            />
                        ) : (
                            (state.status === 'active' || state.status === 'reviewing_attempt') && (
                                <>
                                    <QuizHeader {...uiProps.headerProps} />
                                    
                                    <QuizContentArea />
                                    
                                    <QuizFooter 
                                        dynamicStyle={uiProps.footerStyle}
                                        showExhibitButton={uiProps.showExhibitButton}
                                        showSolutionButton={uiProps.showSolutionButton}
                                    />
                                    
                                    <Exhibit 
                                        isVisible={state.uiState.isExhibitVisible} 
                                        onClose={actions.toggleExhibit} 
                                    />
                                </>
                            )
                        )}
                    </div>
                </TextHighlighterWrapper>
            </QuizTimerProvider>
        </QuizProvider>
    );
}

export default QuizPage;