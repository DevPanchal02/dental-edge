// FILE: client/src/pages/QuizPage.jsx

import React, { useMemo } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { formatDisplayName } from '../services/loader.js';

import QuizHeader from '../components/quiz/QuizHeader';
import QuizFooter from '../components/quiz/QuizFooter';
import QuizContentArea from '../components/quiz/QuizContentArea';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import ResumePromptModal from '../components/ResumePromptModal';
import QuizReviewSummary from '../components/QuizReviewSummary';
import { FaCrown } from 'react-icons/fa';
import PracticeTestOptions from '../components/PracticeTestOptions';
import RegistrationPromptModal from '../components/RegistrationPromptModal';
import Exhibit from '../components/Exhibit'; // <--- ADDED IMPORT

function QuizPage({ isPreviewMode = false }) {
    const { topicId, sectionType, quizId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const reviewAttemptId = location.state?.attemptId;

    const { state, actions } = useQuizEngine(topicId, sectionType, quizId, reviewAttemptId, isPreviewMode);
    
    const layout = !isPreviewMode ? useLayout() : { isSidebarEffectivelyPinned: false };
    const { isSidebarEffectivelyPinned } = layout;
    
    const currentQuestion = useMemo(() => {
        return state.quizContent.questions[state.attempt.currentQuestionIndex] || null;
    }, [state.quizContent.questions, state.attempt.currentQuestionIndex]);

    const uiProps = useMemo(() => {
        const isPractice = state.quizIdentifiers?.sectionType === 'practice';
        const isReviewing = state.status === 'reviewing_attempt';
        const currentIndex = state.attempt.currentQuestionIndex;

        // Determine the question count to display. Default to 210 for previews.
        const displayQuestionCount = isPreviewMode ? 210 : state.quizContent.questions.length;

        return {
            containerStyle: {
                marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
                paddingBottom: '90px',
            },
            footerStyle: {
                left: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
            },
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
                highlightedHtml: state.uiState.highlightedHtml,
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
                timerValue: state.timer.value,
                isCountdown: state.timer.isCountdown,
                initialDuration: state.timer.initialDuration,
                hasStarted: state.status === 'active' || isReviewing,
                onOptionSelect: actions.selectOption,
                onToggleExplanation: actions.toggleExplanation,
                onToggleCrossOff: actions.toggleCrossOff,
                onToggleMark: actions.toggleMark,
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

    if (state.status === 'initializing' || state.status === 'loading') {
        return <LoadingSpinner message="Loading Quiz..." />;
    }

    if (state.status === 'error') {
        return <ErrorDisplay error={state.error?.message || 'An unknown error occurred.'} backLink={isPreviewMode ? '/' : `/app/topic/${topicId}`} backLinkText={isPreviewMode ? 'Back to Home' : 'Back to Topic'} />;
    }
    
    if (state.status === 'prompting_options') {
        return (
            <PracticeTestOptions
                isOpen={true}
                onClose={() => navigate('/')}
                onStartTest={actions.startPreview}
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
    
    const formatTime = (totalSeconds) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className={`quiz-page-container ${isPreviewMode ? 'preview-mode' : ''}`} style={uiProps.containerStyle}>
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
                    timerDisplayContent={`${state.timer.isCountdown ? 'Time Left' : 'Time Elapsed'}: ${formatTime(state.timer.value)}`}
                    dynamicFooterStyle={uiProps.footerStyle}
                    isNavActionInProgress={state.uiState.isSaving}
                />
            ) : (
                (state.status === 'active' || state.status === 'reviewing_attempt') && (
                    <>
                        <QuizHeader {...uiProps.headerProps} />
                        <QuizContentArea {...uiProps.contentAreaProps} />
                        <QuizFooter 
                            {...uiProps.footerProps} 
                            isSaving={state.uiState.isSaving} 
                            dynamicStyle={uiProps.footerStyle} 
                        />
                        {/* --- ADDED EXHIBIT COMPONENT HERE --- */}
                        <Exhibit 
                            isVisible={state.uiState.isExhibitVisible} 
                            onClose={actions.toggleExhibit} 
                        />
                    </>
                )
            )}
        </div>
    );
}

export default QuizPage;
