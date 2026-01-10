import React from 'react';
import '../styles/QuizReviewSummary.css';

function QuizReviewSummary({
    allQuizQuestions,
    quizMetadata,
    markedQuestions,
    submittedAnswers,
    currentQuestionIndexBeforeReview,
    onCloseReviewSummary,
    onJumpToQuestionInQuiz,
    onEndQuiz,
    timerDisplayContent,
    dynamicFooterStyle,
    isNavActionInProgress,
}) {

    const handleJumpFromTable = (index) => {
        onJumpToQuestionInQuiz(index, true); 
    };

    const handleReviewMarked = () => {
        let targetIndex = -1;
        const markedIndices = Object.keys(markedQuestions)
                                .filter(idx => markedQuestions[idx])
                                .map(Number)
                                .sort((a,b) => a - b); 

        if (markedIndices.length === 0) {
            alert("No questions are marked for review.");
            return;
        }
        
        targetIndex = markedIndices.find(idx => !submittedAnswers[idx]);
        if (targetIndex === undefined) {
            targetIndex = markedIndices[0];
        }
        onJumpToQuestionInQuiz(targetIndex, false); 
    };

    const handleReviewAll = () => {
        onJumpToQuestionInQuiz(0, false);
    };

    const handleReviewIncomplete = () => {
        const firstIncompleteIndex = allQuizQuestions.findIndex((q, idx) => !q.error && !submittedAnswers[idx]);
        if (firstIncompleteIndex !== -1) {
            onJumpToQuestionInQuiz(firstIncompleteIndex, false);
        } else {
            alert("All questions have been completed or attempted.");
        }
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
                <div className="qrs-timer-display">
                    {timerDisplayContent}
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
                                    <td colSpan="3">Error loading question</td>
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
                        onClick={onEndQuiz} 
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