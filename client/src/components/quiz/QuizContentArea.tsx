import React, { useRef, useMemo } from 'react';
import QuestionCard from '../QuestionCard';
import TimerDisplay from './TimerDisplay';
import { useQuiz } from '../../context/QuizContext';
import '../../styles/QuizPage.css'; 

// --- Helper Component: MemoizedPassage ---
// Keeps the heavy HTML passage from re-rendering unnecessarily
interface MemoizedPassageProps {
    html: string | undefined;
    passageRef: React.RefObject<HTMLDivElement | null>;
    contentKey: string | null;
    highlightedHtml?: Record<string, string>;
}

const MemoizedPassage = React.memo<MemoizedPassageProps>(function MemoizedPassage({ html, passageRef, contentKey, highlightedHtml }) {
    if (!html) return null;
    
    // Check if we have a highlighted version of this passage in the state
    const displayHtml = (contentKey && highlightedHtml && highlightedHtml[contentKey]) ? highlightedHtml[contentKey] : html;
    
    return (
        <div 
            className="passage-container" 
            ref={passageRef} 
            dangerouslySetInnerHTML={{ __html: displayHtml }} 
            data-content-key={contentKey}
        />
    );
});

/**
 * Smart Component: QuizContentArea
 * 
 * Responsibilities:
 * 1. Consumes QuizContext to get current question data.
 * 2. Determines visual states (review mode, submitted, etc.).
 * 3. Renders the Passage and QuestionCard.
 * 4. Manages the Passage DOM ref internally.
 */
const QuizContentArea: React.FC = () => {
    const { state, actions } = useQuiz();
    const { attempt, quizContent, uiState, status, quizIdentifiers } = state;

    // Internal Ref for the passage (owned here, not in QuizPage)
    const passageContainerRef = useRef<HTMLDivElement>(null);

    // --- Derived State ---
    const questionIndex = attempt.currentQuestionIndex;
    const currentQuestion = useMemo(() => quizContent.questions[questionIndex] || null, [quizContent.questions, questionIndex]);
    
    // Guard: Loading or Error states
    const hasStarted = status === 'active' || status === 'reviewing_attempt';
    if (!hasStarted) return <div className="page-loading">Preparing Practice Test...</div>;
    if (!currentQuestion) return <div className="page-error">Error: Could not load the current question.</div>;

    // Logic extraction
    const topicId = quizIdentifiers?.topicId || '';
    const sectionType = quizIdentifiers?.sectionType || 'practice';
    const isPractice = sectionType === 'practice';
    const isReviewMode = status === 'reviewing_attempt';
    
    // Visual Flags
    const isSubmitted = (isPractice && !!attempt.submittedAnswers?.[questionIndex]) || 
                        (!isPractice && (!!attempt.submittedAnswers?.[questionIndex] || isReviewMode || !!uiState.tempReveal[questionIndex]));
    const isTemporarilyRevealed = !!uiState.tempReveal[questionIndex];
    const isPracticeTestActive = isPractice && !isReviewMode;
    const showExplanation = !!uiState.showExplanation[questionIndex];
    
    // Data extraction
    const passageHtml = currentQuestion.passage?.html_content;
    const passageContentKey = passageHtml && currentQuestion.category ? `passage_${currentQuestion.category}` : null;
    const userAnswer = attempt.userAnswers[questionIndex];
    const currentCrossedOffForCard = attempt.crossedOffOptions[questionIndex] || new Set<string>();
    const timeSpent = attempt.userTimeSpent[questionIndex];
    const highlightedHtml = attempt.highlightedHtml;

    return (
        <>
            {/* Standard Layout: Passage Top, Question Bottom */}
            {passageHtml && topicId !== 'reading-comprehension' && (
                <MemoizedPassage
                    html={passageHtml}
                    passageRef={passageContainerRef}
                    contentKey={passageContentKey}
                    highlightedHtml={highlightedHtml}
                />
            )}

            <div className="quiz-controls-top">
                {/* Timer is hidden in review mode */}
                {!isReviewMode ? (
                    <TimerDisplay />
                ) : (
                    <div className="timer-display-placeholder"></div>
                )}
            </div>

            <div className="quiz-content-area">
                <QuestionCard
                    questionData={currentQuestion}
                    questionIndex={questionIndex}
                    selectedOption={userAnswer}
                    crossedOffOptions={currentCrossedOffForCard}
                    isSubmitted={isSubmitted}
                    isReviewMode={isReviewMode}
                    isTemporarilyRevealed={isTemporarilyRevealed}
                    isPracticeTestActive={isPracticeTestActive}
                    showExplanation={showExplanation}
                    userTimeSpentOnQuestion={timeSpent}
                    highlightedHtml={highlightedHtml}
                    
                    // Actions mapped directly from Context
                    onOptionSelect={actions.selectOption}
                    onToggleExplanation={actions.toggleExplanation}
                    onToggleCrossOff={actions.toggleCrossOff}
                    onToggleMark={actions.toggleMark}
                />
            </div>
            
            {/* Reading Comp Layout: Question Top, Passage Bottom */}
            {passageHtml && topicId === 'reading-comprehension' && (
                <div className="passage-wrapper-below" style={{ marginTop: '20px' }}>
                    <MemoizedPassage
                        html={passageHtml}
                        passageRef={passageContainerRef}
                        contentKey={passageContentKey}
                        highlightedHtml={highlightedHtml}
                    />
                </div>
            )}
        </>
    );
};

export default QuizContentArea;