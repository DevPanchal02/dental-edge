// FILE: client/src/components/quiz/QuizContentArea.jsx

import React from 'react';
import QuestionCard from '../QuestionCard';
import '../../styles/QuizPage.css'; // Reusing styles

// A memoized component for the passage to prevent re-renders when only question state changes.
const MemoizedPassage = React.memo(function MemoizedPassage({ html, passageRef, contentKey, highlightedHtml }) {
    if (!html) {
        return null;
    }
    const displayHtml = highlightedHtml?.[contentKey] ?? html;
    return (
        <div 
            className="passage-container" 
            ref={passageRef} 
            dangerouslySetInnerHTML={{ __html: displayHtml }} 
            data-content-key={contentKey}
        />
    );
});

// Utility to format time from seconds into MM:SS format.
const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function QuizContentArea({
    // Data props
    currentQuestion,
    passageHtml,
    highlightedHtml,
    topicId,

    // State props from the engine
    questionIndex,
    userAnswer,
    crossedOffOptions,
    timeSpent,
    isMarked,
    isSubmitted,
    isReviewMode,
    isTemporarilyRevealed,
    isPracticeTestActive,
    showExplanation,

    // Timer props
    timerValue,
    isCountdown,
    initialDuration,
    hasStarted,

    // Action/handler props
    onOptionSelect,
    onToggleExplanation,
    onToggleCrossOff,
    onToggleMark,

    // Ref props
    passageContainerRef
}) {

    if (!hasStarted) {
        // Render a placeholder or loading state before the practice test officially begins
        return <div className="page-loading">Preparing Practice Test...</div>;
    }

    if (!currentQuestion) {
        return <div className="page-error">Error: Could not load the current question.</div>;
    }

    // Determine the content key for the passage for highlighting purposes
    const passageContentKey = passageHtml && currentQuestion ? `passage_${currentQuestion.category}` : null;
    const EMPTY_SET = new Set();
    const currentCrossedOffForCard = crossedOffOptions[questionIndex] || EMPTY_SET;

    const timerDisplayComponent = (
        <>
            {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
            <span className={isCountdown && timerValue < 60 && timerValue > 0 ? 'timer-low' : ''}>
                {formatTime(timerValue)}
            </span>
            {isCountdown && initialDuration > 0 && (
                <span className="timer-total"> / {formatTime(initialDuration)}</span>
            )}
        </>
    );

    return (
        <>
            {/* Renders the passage above the question if it's not Reading Comp */}
            {passageHtml && topicId !== 'reading-comprehension' && (
                <MemoizedPassage
                    html={passageHtml}
                    passageRef={passageContainerRef}
                    contentKey={passageContentKey}
                    highlightedHtml={highlightedHtml}
                />
            )}

            <div className="quiz-controls-top">
                {/* The timer is only visible during an active quiz, not in review mode */}
                {!isReviewMode ? (
                    <div className="timer-display">{timerDisplayComponent}</div>
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
                    isMarked={isMarked}
                    isTemporarilyRevealed={isTemporarilyRevealed}
                    isPracticeTestActive={isPracticeTestActive}
                    showExplanation={showExplanation}
                    userTimeSpentOnQuestion={timeSpent}
                    highlightedHtml={highlightedHtml}
                    onOptionSelect={onOptionSelect}
                    onToggleExplanation={onToggleExplanation}
                    onToggleCrossOff={onToggleCrossOff}
                    onToggleMark={onToggleMark}
                />
            </div>
            
            {/* Renders the passage below the question specifically for Reading Comp */}
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
}

export default QuizContentArea;