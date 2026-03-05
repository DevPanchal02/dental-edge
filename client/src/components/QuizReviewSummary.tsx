import React from 'react';
import '../styles/QuizReviewSummary.css';
import { Question, QuizMetadata } from '../types/quiz.types';
import TimerDisplay from './quiz/TimerDisplay';
import { useQuizTimer } from '../context/QuizTimerContext'; 

interface QuizReviewSummaryProps {
    allQuizQuestions: Question[];
    quizMetadata: QuizMetadata | null;
    markedQuestions: Record<number, boolean>;
    submittedAnswers: Record<number, boolean>;
    userAnswers: Record<number, string>; 
    topicId: string; 
    
    currentQuestionIndexBeforeReview: number;
    onCloseReviewSummary: () => void;
    onJumpToQuestionInQuiz: (index: number) => void;
    
    // Inject the new targeted review hook
    onStartTargetedReview: (indices: number[]) => void;

    onEndQuiz: (finalTime: number) => void;
    
    dynamicFooterStyle: React.CSSProperties;
    isNavActionInProgress: boolean;
}

const QuizReviewSummary: React.FC<QuizReviewSummaryProps> = ({
    allQuizQuestions,
    quizMetadata,
    markedQuestions,
    submittedAnswers,
    currentQuestionIndexBeforeReview,
    onCloseReviewSummary,
    onJumpToQuestionInQuiz,
    onStartTargetedReview,
    onEndQuiz,
    dynamicFooterStyle,
    isNavActionInProgress,
}) => {
    // Access the Timer Context directly
    const { timerState } = useQuizTimer();

    const handleJumpFromTable = (index: number) => {
        // Direct jump from table always breaks out of a targeted sequence
        onJumpToQuestionInQuiz(index); 
    };

    const handleReviewMarked = () => {
        const markedIndices = Object.keys(markedQuestions)
                                .filter(idx => markedQuestions[Number(idx)])
                                .map(Number)
                                .sort((a,b) => a - b); 

        if (markedIndices.length === 0) {
            alert("No questions are marked for review.");
            return;
        }
        
        // Feed the entire array into the targeted review engine
        onStartTargetedReview(markedIndices);
    };

    const handleReviewAll = () => {
        onJumpToQuestionInQuiz(0);
    };

    const handleReviewIncomplete = () => {
        // Collect all indices that have no submitted answer
        const incompleteIndices = allQuizQuestions
            .map((q, idx) => ({ q, idx }))
            .filter(({ q, idx }) => !q.error && !submittedAnswers[idx])
            .map(({ idx }) => idx);

        if (incompleteIndices.length === 0) {
            alert("All questions have been completed or attempted.");
            return;
        }

        // Feed into sequence engine
        onStartTargetedReview(incompleteIndices);
    };

    const handleEndQuizClick = () => {
        const value = timerState.mode === 'countdown' 
            ? timerState.secondsRemaining 
            : timerState.secondsElapsed;
        
        onEndQuiz(value);
    };

    return (
        <div className="quiz-review-summary-container">
            <div className="quiz-review-summary-header">
                <button
                    onClick={onCloseReviewSummary}
                    className="qrs-back-button"
                    disabled={isNavActionInProgress}
                >
                    ← Back to Question {currentQuestionIndexBeforeReview + 1}
                </button>
                <div className="qrs-title-container">
                    <h1 className="qrs-title">{quizMetadata?.fullNameForDisplay || quizMetadata?.name || 'Review Quiz'}</h1>
                </div>
                <div className="qrs-timer-wrapper">
                    <TimerDisplay className="qrs-timer-display" />
                </div>
            </div>

            <div className="quiz-review-summary-table-container">
                <table className="quiz-review-summary-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Marked</th>
                            <th>Completed</th>
                            <th>Skipped</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allQuizQuestions.map((q, index) => {
                            if (!q || q.error) return (
                                <tr key={`error-${index}`} className="qrs-row-error">
                                    <td>Question {index + 1}</td>
                                    <td colSpan={3}>Error loading question</td>
                                </tr>
                            );

                            const isMarked = !!markedQuestions[index];
                            const isCompleted = !!submittedAnswers[index];
                            const isSkipped = !isCompleted;

                            return (
                                <tr key={index} className={`qrs-row ${index === currentQuestionIndexBeforeReview ? 'qrs-current-highlight' : ''}`}>
                                    <td className="qrs-cell-name">
                                        <button
                                            onClick={() => handleJumpFromTable(index)}
                                            className="qrs-jump-button"
                                            title={`Jump to Question ${index + 1}`}
                                            disabled={isNavActionInProgress}
                                        >
                                            Question {index + 1}
                                        </button>
                                    </td>
                                    <td className="qrs-cell-marked">
                                        {isMarked ? (
                                            <span className="qrs-status-marked" title="Marked for Review">🚩 Yes</span>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </td>
                                    <td className="qrs-cell-completed">
                                        {isCompleted ? (
                                            <span className="qrs-status-completed" title="Completed">✓ Yes</span>
                                        ) : (
                                            <span className="qrs-status-not-completed" title="Not Completed">-</span>
                                        )}
                                    </td>
                                    <td className="qrs-cell-skipped">
                                        {isSkipped ? (
                                            <span className="qrs-status-skipped" title="Skipped">○ Yes</span>
                                        ) : (
                                             <span className="qrs-status-not-skipped" title="Not Skipped">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="quiz-review-summary-footer" style={dynamicFooterStyle}>
                <div className="qrs-footer-group-left">
                    <button
                        onClick={handleReviewMarked}
                        className="qrs-footer-button review-marked"
                        disabled={isNavActionInProgress}
                    >
                        Review Marked
                    </button>
                    <button
                        onClick={handleReviewAll}
                        className="qrs-footer-button review-all"
                        disabled={isNavActionInProgress}
                    >
                        Review All
                    </button>
                    <button
                        onClick={handleReviewIncomplete}
                        className="qrs-footer-button review-incomplete"
                        disabled={isNavActionInProgress}
                    >
                        Review Incomplete
                    </button>
                </div>
                <div className="qrs-footer-group-right">
                    <button
                        onClick={handleEndQuizClick} 
                        className="qrs-footer-button end-quiz"
                        disabled={isNavActionInProgress}
                    >
                        End Quiz
                    </button>
                </div>
            </div>
        </div>
    );
}

export default QuizReviewSummary;