import React from 'react';
import { useQuiz } from '../../context/QuizContext';
import '../../styles/QuizPage.css';

interface QuizFooterProps {
    dynamicStyle: React.CSSProperties;
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
    const isMarked = !!attempt.markedQuestions[currentIndex];
    const isReviewMode = status === 'reviewing_attempt';
    const hasStarted = status === 'active' || isReviewMode;
    const isSaving = uiState.isSaving;
    const solutionVisible = !!uiState.tempReveal[currentIndex];
    
    const targetedSequence = uiState.targetedReviewSequence;
    const isTargetedReview = targetedSequence && targetedSequence.length > 0;

    let isFirstQuestion = false;
    let isLastQuestion = false;
    let nextButtonText = 'Next';

    // Calculate boundary states based on the active navigation mode (Linear vs Targeted Sequence)
    if (isTargetedReview && targetedSequence) {
        const seqIndex = targetedSequence.indexOf(currentIndex);
        isFirstQuestion = seqIndex === 0;
        isLastQuestion = seqIndex === targetedSequence.length - 1;
        nextButtonText = isLastQuestion ? 'Finish Review' : 'Next';
    } else {
        isFirstQuestion = currentIndex === 0;
        isLastQuestion = currentIndex === (quizContent.questions.length - 1);
        nextButtonText = (isReviewMode && isLastQuestion) ? 'Back to Results' : 'Next';
    }

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
                    {nextButtonText}
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