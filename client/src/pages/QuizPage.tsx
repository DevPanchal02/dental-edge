import React, { useMemo, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { QuizTimerProvider, useQuizTimer } from '../context/QuizTimerContext'; // New Context
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

// Types
import { SectionType } from '../types/content.types';

/**
 * Headless Component: QuizTimerSync
 * 
 * Acts as a bridge between the 'QuizEngine' (Data Source) and 'QuizTimerContext' (UI State).
 * It ensures the timer initializes correctly when a quiz is loaded or resumed, 
 * without forcing the parent to manage context logic imperatively.
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
        // Trigger initialization only when the engine signals 'active' state for the first time
        if ((status === 'active' || status === 'reviewing_attempt') && !hasInitialized.current) {
            const mode = isCountdown ? 'countdown' : 'countup';
            
            // 1. Configure the timer parameters
            initializeTimer(initialDuration, mode);

            // 2. Sync to the exact current value (crucial for resuming attempts)
            //    For countdown: remaining = timerValue
            //    For countup: elapsed = timerValue
            if (isCountdown) {
                syncTimer(timerValue, initialDuration - timerValue);
            } else {
                syncTimer(initialDuration - timerValue, timerValue);
            }

            // 3. Begin the independent tick cycle
            if (status === 'active') {
                startTimer();
            }
            
            hasInitialized.current = true;
        }

        // Halt the timer if the quiz ends or errors out
        if (status === 'completed' || status === 'error') {
            stopTimer();
        }
    }, [status, timerValue, initialDuration, isCountdown, initializeTimer, startTimer, stopTimer, syncTimer]);

    return null; // This component renders nothing visible
};


interface QuizPageProps {
    isPreviewMode?: boolean;
}

/**
 * The Root Orchestrator for the Quiz Experience.
 * 
 * Architecture Note:
 * This component wraps the experience in the QuizTimerProvider to isolate high-frequency 
 * timer updates. It delegates DOM interactions to TextHighlighterWrapper and 
 * business logic to useQuizEngine.
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
    const { state, actions } = useQuizEngine(
        topicId, 
        sectionType as SectionType, 
        quizId, 
        reviewAttemptId, 
        isPreviewMode
    );
    
    const { isSidebarEffectivelyPinned } = useLayout();

    // Stable Ref: Prevents Passage re-renders during parent updates
    const passageRef = useRef<HTMLDivElement>(null);
    
    // Memoized Data: Isolates the heavy question object
    const currentQuestion = useMemo(() => {
        return state.quizContent.questions[state.attempt.currentQuestionIndex] || null;
    }, [state.quizContent.questions, state.attempt.currentQuestionIndex]);

    // Computed Props: Ensures referential stability for child components
    const uiProps = useMemo(() => {
        const isPractice = state.quizIdentifiers?.sectionType === 'practice';
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
            
            contentAreaProps: {
                currentQuestion: currentQuestion,
                passageHtml: currentQuestion?.passage?.html_content,
                highlightedHtml: state.attempt.highlightedHtml, 
                topicId: topicId,
                questionIndex: currentIndex,
                userAnswer: state.attempt.userAnswers[currentIndex],
                crossedOffOptions: state.attempt.crossedOffOptions,
                isMarked: !!state.attempt.markedQuestions[currentIndex],
                isSubmitted: (isPractice && !!state.attempt.submittedAnswers?.[currentIndex]) || (!isPractice && (!!state.attempt.submittedAnswers?.[currentIndex] || isReviewing || !!state.uiState.tempReveal[currentIndex])),
                isReviewMode: isReviewing,
                isTemporarilyRevealed: !!state.uiState.tempReveal[currentIndex],
                isPracticeTestActive: isPractice && !isReviewing,
                showExplanation: !!state.uiState.showExplanation[currentIndex],
                timeSpent: state.attempt.userTimeSpent[currentIndex],
                // Timer props removed; handled by Context/TimerDisplay
                hasStarted: state.status === 'active' || isReviewing,
                onOptionSelect: actions.selectOption,
                onToggleExplanation: actions.toggleExplanation,
                onToggleCrossOff: actions.toggleCrossOff,
                onToggleMark: actions.toggleMark,
                passageContainerRef: passageRef,
            },
            
            footerProps: {
                onNext: actions.nextQuestion,
                onPrevious: actions.previousQuestion,
                onMark: actions.toggleMark,
                onReview: actions.openReviewSummary,
                onToggleExhibit: actions.toggleExhibit,
                onToggleSolution: actions.toggleSolution,
                isFirstQuestion: currentIndex === 0,
                isLastQuestion: currentIndex === state.quizContent.questions.length - 1,
                isMarked: !!state.attempt.markedQuestions[currentIndex],
                isSaving: state.uiState.isSaving,
                isReviewMode: isReviewing,
                hasStarted: state.status === 'active' || isReviewing,
                showExhibitButton: topicId === 'chemistry',
                showSolutionButton: state.quizIdentifiers?.sectionType === 'qbank',
                solutionVisible: !!state.uiState.tempReveal[currentIndex],
            },
        };
    }, [state, actions, isSidebarEffectivelyPinned, topicId, sectionType, quizId, isPreviewMode, currentQuestion]);

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
    
    // --- Modal States (Pre-Context) ---
    // These block the main UI, so we render them before the Provider setup
    
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
    
    // --- Main Render (Protected by Timer Context) ---

    return (
        <QuizTimerProvider>
            {/* The Sync component bridges the Engine state to the Timer Context */}
            <QuizTimerSync 
                status={state.status}
                timerValue={state.timer.value}
                initialDuration={state.timer.initialDuration}
                isCountdown={state.timer.isCountdown}
            />

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
                                    {...uiProps.contentAreaProps} 
                                    passageContainerRef={passageRef}
                                />
                                
                                <QuizFooter 
                                    {...uiProps.footerProps} 
                                    dynamicStyle={uiProps.footerStyle} 
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
    );
}

export default QuizPage;