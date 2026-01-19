import React from 'react';
import QuestionCard from '../QuestionCard';
import TimerDisplay from './TimerDisplay';
import '../../styles/QuizPage.css'; 
import { Question } from '../../types/quiz.types';

interface MemoizedPassageProps {
    html: string | undefined;
    passageRef: React.RefObject<HTMLDivElement | null>;
    contentKey: string | null;
    highlightedHtml?: Record<string, string>;
}

const MemoizedPassage = React.memo<MemoizedPassageProps>(function MemoizedPassage({ html, passageRef, contentKey, highlightedHtml }) {
    if (!html) {
        return null;
    }
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

    // Timer Props REMOVED - Now handled by Context/TimerDisplay
    hasStarted: boolean;

    // Actions
    onOptionSelect: (index: number, label: string) => void;
    onToggleExplanation: (index: number) => void;
    onToggleCrossOff: (index: number, label: string) => void;
    onToggleMark: (index: number) => void;

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

    const passageContentKey = passageHtml && currentQuestion.category ? `passage_${currentQuestion.category}` : null;
    const EMPTY_SET = new Set<string>();
    const currentCrossedOffForCard = crossedOffOptions[questionIndex] || EMPTY_SET;

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