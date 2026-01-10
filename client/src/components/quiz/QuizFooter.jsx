// FILE: client/src/components/quiz/QuizFooter.jsx

import React from 'react';
import '../../styles/QuizPage.css'; // Reusing styles

function QuizFooter({
    onNext,
    onPrevious,
    onMark,
    onReview,
    onToggleExhibit,
    onToggleSolution,
    isFirstQuestion,
    isLastQuestion,
    isMarked,
    isSaving,
    isReviewMode,
    hasStarted,
    showExhibitButton,
    showSolutionButton,
    solutionVisible,
    dynamicStyle, // For sidebar adjustment
}) {
    // In review mode, the main button should navigate back to the results page
    const handleMainAction = () => {
        if (isReviewMode) {
            // This would be a navigate function passed from the parent
            onNext(); 
        } else {
            onNext();
        }
    };

    return (
        <div className="quiz-navigation" style={dynamicStyle}>
            <div className="nav-group-left">
                <button
                    onClick={onPrevious}
                    disabled={isFirstQuestion || !hasStarted || isSaving}
                    className="nav-button prev-button"
                >
                    Previous
                </button>
                {showSolutionButton && !isReviewMode && (
                    <button onClick={onToggleSolution} className="nav-button solution-toggle-button-bottom">
                        {solutionVisible ? "Hide Solution" : "'S' Solution"}
                    </button>
                )}
            </div>
            <div className="nav-group-center">
                <button
                    onClick={handleMainAction}
                    className="nav-button next-button"
                    disabled={!hasStarted || isSaving}
                >
                    {isReviewMode && isLastQuestion ? 'Back to Results' : 'Next'}
                </button>
            </div>
            <div className="nav-group-right">
                {!isReviewMode && hasStarted && (
                    <>
                        <button
                            onClick={onMark}
                            className={`mark-button-nav ${isMarked ? 'marked' : ''}`}
                            title={isMarked ? "Unmark this question" : "Mark for review"}
                            disabled={isSaving}
                        >
                            {isMarked ? '🚩 Unmark' : '🏳️ Mark'}
                        </button>
                        
                        {showExhibitButton && (
                            <button onClick={onToggleExhibit} className="nav-button exhibit-button">
                                Exhibit
                            </button>
                        )}

                        <button onClick={onReview} className="nav-button review-button-bottom" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Review'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default QuizFooter;