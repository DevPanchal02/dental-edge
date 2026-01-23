import React, { useMemo, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { QuizTimerProvider, useQuizTimer } from '../context/QuizTimerContext';
import { QuizProvider } from '../context/QuizContext';
import { formatDisplayName } from '../services/loader';

// Components
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
import QuizPersistence from '../components/quiz/QuizPersistence'; // NEW Import

// Types
import { SectionType } from '../types/content.types';

/**
 * Headless Component: QuizTimerSync
 * 
 * Acts as a bridge between the 'QuizEngine' (Data Source) and 'QuizTimerContext' (UI State).
 * It ensures the timer initializes correctly when a quiz is loaded or resumed.
 */
const QuizTimerSync: React.FC<{
    status: string;
    timerValue: number;
    initialDuration: number;
    isCountdown: boolean;
}> = ({ status, timerValue, initialDuration, isCountdown }) => {
    const { initializeTimer, startTimer, stopTimer, syncTimer } = useQuizTimer();
    const hasInitialized = useRef(false);

    useEffect(() => {
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
        if (status === 'completed' || status === 'error') stopTimer();
    }, [status, timerValue, initialDuration, isCountdown, initializeTimer, startTimer, stopTimer, syncTimer]);

    return null;
};

interface QuizPageProps {
    isPreviewMode?: boolean;
}

/**
 * The Root Orchestrator for the Quiz Experience.
 */
const QuizPage: React.FC<QuizPageProps> = ({ isPreviewMode = false }) => {
    const { topicId = '', sectionType = 'practice', quizId = '' } = useParams<{ 
        topicId: string; 
        sectionType: string; 
        quizId: string; 
    }>();
    
    const location = useLocation();
    const navigate = useNavigate();

    const reviewAttemptId = (location.state as { attemptId?: string })?.attemptId;

    // Initialize the Business Logic Engine
    const quizEngine = useQuizEngine(
        topicId, 
        sectionType as SectionType, 
        quizId, 
        reviewAttemptId, 
        isPreviewMode
    );
    const { state, actions } = quizEngine;
    
    const { isSidebarEffectivelyPinned } = useLayout();

    // Computed Props Strategy
    const uiProps = useMemo(() => {
        const isReviewing = state.status === 'reviewing_attempt';
        const currentIndex = state.attempt.currentQuestionIndex;
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
    }, [state.status, state.attempt.currentQuestionIndex, state.quizContent.questions.length, state.quizContent.metadata, state.quizIdentifiers, isSidebarEffectivelyPinned, topicId, sectionType, quizId, isPreviewMode]);

    // --- Loading & Error States ---

    if (state.status === 'initializing' || state.status === 'loading') {
        return <LoadingSpinner message="Loading Quiz..." />;
    }

    if (state.status === 'error') {
        return <ErrorDisplay 
            error={state.error?.message || 'An unknown error occurred.'} 
            backLink={isPreviewMode ? '/' : `/app/topic/${topicId}`} 
            backLinkText={isPreviewMode ? 'Back to Home' : 'Back to Topic'} 
        />;
    }
    
    // --- Modals ---
    
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
    
    // --- Main Render ---

    return (
        <QuizProvider value={quizEngine}>
            <QuizTimerProvider>
                {/* 1. Sync Engine -> Timer Context */}
                <QuizTimerSync 
                    status={state.status}
                    timerValue={state.timerSnapshot.value}
                    initialDuration={state.timerSnapshot.initialDuration}
                    isCountdown={state.timerSnapshot.isCountdown}
                />

                {/* 2. Sync Timer Context -> Database (Auto-Save) */}
                <QuizPersistence />

                {/* 3. Render UI */}
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
                                    
                                    <QuizContentArea 
                                    />
                                    
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