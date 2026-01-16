import React from 'react';
import QuestionCard from '../QuestionCard';
import '../../styles/QuizPage.css'; 
import { Question } from '../../types/quiz.types';

interface MemoizedPassageProps {
    html: string | undefined;
    // FIX: Allow null in the RefObject to match useRef(null) behavior in parent
    passageRef: React.RefObject<HTMLDivElement | null>;
    contentKey: string | null;
    highlightedHtml?: Record<string, string>;
}

// Optimization: The passage is heavy HTML. We use React.memo to ensure it doesn't 
// re-parse/re-render when the user selects a radio button in the question area.
const MemoizedPassage = React.memo<MemoizedPassageProps>(function MemoizedPassage({ html, passageRef, contentKey, highlightedHtml }) {
    if (!html) {
        return null;
    }
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

const formatTime = (totalSeconds: number): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface QuizContentAreaProps {
    currentQuestion: Question | null;
    passageHtml?: string;
    highlightedHtml?: Record<string, string>;
    topicId: string;

    // State passed from useQuizEngine
    questionIndex: number;
    userAnswer: string | null | undefined;
    crossedOffOptions: Record<number, Set<string>>;
    timeSpent?: number;
    isMarked: boolean;
    isSubmitted: boolean;
    isReviewMode: boolean;
    isTemporarilyRevealed: boolean;
    isPracticeTestActive: boolean;
    showExplanation: boolean;

    // Timer State
    timerValue: number;
    isCountdown: boolean;
    initialDuration: number;
    hasStarted: boolean;

    // Actions
    onOptionSelect: (index: number, label: string) => void;
    onToggleExplanation: (index: number) => void;
    onToggleCrossOff: (index: number, label: string) => void;
    onToggleMark: (index: number) => void;

    // FIX: Match the Ref definition in MemoizedPassageProps (allow null)
    passageContainerRef: React.RefObject<HTMLDivElement | null>;
}

const QuizContentArea: React.FC<QuizContentAreaProps> = ({
    currentQuestion,
    passageHtml,
    highlightedHtml,
    topicId,

    questionIndex,
    userAnswer,
    crossedOffOptions,
    timeSpent,
    isSubmitted,
    isReviewMode,
    isTemporarilyRevealed,
    isPracticeTestActive,
    showExplanation,

    timerValue,
    isCountdown,
    initialDuration,
    hasStarted,

    onOptionSelect,
    onToggleExplanation,
    onToggleCrossOff,
    onToggleMark,

    passageContainerRef
}) => {

    if (!hasStarted) {
        return <div className="page-loading">Preparing Practice Test...</div>;
    }

    if (!currentQuestion) {
        return <div className="page-error">Error: Could not load the current question.</div>;
    }

    // Determine key for passage highlighting persistence
    const passageContentKey = passageHtml && currentQuestion.category ? `passage_${currentQuestion.category}` : null;
    
    // Default empty set for safety if state is missing
    const EMPTY_SET = new Set<string>();
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
                    // FIX: Removed 'isMarked={isMarked}' prop. Visual marking is handled by the footer, not the card content.
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