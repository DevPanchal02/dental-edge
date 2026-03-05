import React, { useMemo } from 'react';
import '../styles/ResultsPage.css';

interface ResultsGridProps {
    totalQuestions: number;
    correctIndices: number[];
    incorrectIndices: number[];
    skippedIndices: number[];
    markedIndicesArray: number[];
    markedQuestions: Record<number, boolean>;
    onQuestionClick: (index: number) => void;
    onReviewSequence: (indices: number[]) => void;
}

/**
 * Interactive map for spotting error clusters and jumping directly to review.
 * Legend now acts as a quick-filter to launch targeted review sequences.
 */
const ResultsGrid: React.FC<ResultsGridProps> = ({
    totalQuestions,
    correctIndices,
    incorrectIndices,
    skippedIndices,
    markedIndicesArray,
    markedQuestions,
    onQuestionClick,
    onReviewSequence
}) => {
    // Lookups to prevent render blocking on 100+ question tests.
    const { correctSet, incorrectSet } = useMemo(() => ({
        correctSet: new Set(correctIndices),
        incorrectSet: new Set(incorrectIndices)
    }),[correctIndices, incorrectIndices]);

    const gridCells = Array.from({ length: totalQuestions }, (_, i) => i);

    // Helper to render interactive legend buttons with unified disabled/hover logic
    const renderLegendButton = (label: string, typeClass: string, indices: number[], markerText: string = '') => {
        const isEmpty = indices.length === 0;
        const hoverText = isEmpty 
            ? `No ${label.toLowerCase()} questions in this attempt.` 
            : `Review all ${indices.length} ${label.toLowerCase()} questions`;

        return (
            <button 
                className={`legend-item interactive-legend ${isEmpty ? 'disabled' : ''}`}
                onClick={() => !isEmpty && onReviewSequence(indices)}
                disabled={isEmpty}
                title={hoverText}
                aria-label={hoverText}
            >
                {markerText ? (
                    <span className="legend-marker">{markerText}</span>
                ) : (
                    <span className={`legend-box ${typeClass}`}></span>
                )}
                {label} ({indices.length})
            </button>
        );
    };

    return (
        <div className="results-grid-container">
            <div className="results-grid-header">
                <h3>Question Breakdown</h3>
                <div className="results-grid-legend">
                    {renderLegendButton('Correct', 'correct', correctIndices)}
                    {renderLegendButton('Incorrect', 'incorrect', incorrectIndices)}
                    {renderLegendButton('Skipped', 'skipped', skippedIndices)}
                    {renderLegendButton('Marked', '', markedIndicesArray, '🚩')}
                </div>
            </div>

            <div className="results-grid-layout">
                {gridCells.map((index) => {
                    const isCorrect = correctSet.has(index);
                    const isIncorrect = incorrectSet.has(index);
                    const isMarked = !!markedQuestions[index];

                    let statusClass = 'skipped';
                    let statusText = 'Skipped';
                    
                    if (isCorrect) {
                        statusClass = 'correct';
                        statusText = 'Correct';
                    } else if (isIncorrect) {
                        statusClass = 'incorrect';
                        statusText = 'Incorrect';
                    }

                    return (
                        <button
                            key={index}
                            className={`results-grid-cell ${statusClass}`}
                            onClick={() => onQuestionClick(index)}
                            title={`Question ${index + 1} - ${statusText}${isMarked ? ' (Marked for Review)' : ''}`}
                            aria-label={`Go to Question ${index + 1}, ${statusText}`}
                        >
                            <span className="cell-number">{index + 1}</span>
                            {isMarked && <span className="cell-marker">🚩</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(ResultsGrid);