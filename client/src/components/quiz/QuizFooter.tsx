import React from 'react';
import { useQuiz } from '../../context/QuizContext';
import '../../styles/QuizPage.css';

interface QuizFooterProps {
    dynamicStyle: React.CSSProperties;
    
    // Feature flags can still be passed if they are purely presentational overrides,
    // but typically we can derive them from state too. For now, we keep them to match
    // the specific logic in QuizPage's useMemo until we refactor that logic into the Context.
    showExhibitButton: boolean;
    showSolutionButton: boolean;
}

const QuizFooter: React.FC<QuizFooterProps> = ({
    dynamicStyle,
    showExhibitButton,
    showSolutionButton,
}) => {
    const { state, actions } = useQuiz();
    const { attempt, uiState, quizContent, status } = state;

    const currentIndex = attempt.currentQuestionIndex;
    const isFirstQuestion = currentIndex === 0;
    const isLastQuestion = currentIndex === (quizContent.questions.length - 1);
    const isMarked = !!attempt.markedQuestions[currentIndex];
    const isReviewMode = status === 'reviewing_attempt';
    const hasStarted = status === 'active' || isReviewMode;
    const isSaving = uiState.isSaving;
    const solutionVisible = !!uiState.tempReveal[currentIndex];

    // Abstraction for the primary action button.
    const handleMainAction = () => {
        actions.nextQuestion();
    };

    return (
        <div className="quiz-navigation" style={dynamicStyle}>
            <div className="nav-group-left">
                <button
                    onClick={actions.previousQuestion}
                    disabled={isFirstQuestion || !hasStarted || isSaving}
                    className="nav-button prev-button"
                >
                    Previous
                </button>
                {showSolutionButton && !isReviewMode && (
                    <button onClick={actions.toggleSolution} className="nav-button solution-toggle-button-bottom">
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
                            onClick={actions.toggleMark}
                            className={`mark-button-nav ${isMarked ? 'marked' : ''}`}
                            title={isMarked ? "Unmark this question" : "Mark for review"}
                            disabled={isSaving}
                        >
                            {isMarked ? '🚩 Unmark' : '🏳️ Mark'}
                        </button>
                        
                        {showExhibitButton && (
                            <button onClick={actions.toggleExhibit} className="nav-button exhibit-button">
                                Exhibit
                            </button>
                        )}

                        <button onClick={actions.openReviewSummary} className="nav-button review-button-bottom" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Review'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default QuizFooter;