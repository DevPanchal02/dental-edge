import React from 'react';
import '../../styles/QuizPage.css';

interface QuizFooterProps {
    // Action Handlers - Strictly typed as void functions to indicate side-effects
    onNext: () => void;
    onPrevious: () => void;
    onMark: () => void;
    onReview: () => void;
    onToggleExhibit: () => void;
    onToggleSolution: () => void;

    // State Flags - Boolean flags control the visual state machine
    isFirstQuestion: boolean;
    isLastQuestion: boolean;
    isMarked: boolean;
    isSaving: boolean;
    isReviewMode: boolean;
    hasStarted: boolean;
    
    // Feature Flags - derived from Topic/Quiz metadata
    showExhibitButton: boolean;
    showSolutionButton: boolean;
    solutionVisible: boolean;

    // Layout - React.CSSProperties ensures type safety for inline styles (e.g., 'left' must be string/number)
    dynamicStyle: React.CSSProperties;
}

const QuizFooter: React.FC<QuizFooterProps> = ({
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
    dynamicStyle,
}) => {
    
    // Abstraction for the primary action button.
    // In Review Mode, "Next" contextually becomes "Return to Results".
    const handleMainAction = () => {
        onNext();
    };

    return (
        <div className="quiz-navigation" style={dynamicStyle}>
            <div className="nav-group-left">
                {/* 
                    We disable controls during 'isSaving' to prevent race conditions 
                    where a user might navigate before the previous answer is persisted.
                */}
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
};

export default QuizFooter;