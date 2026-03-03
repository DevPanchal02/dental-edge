import React, { useMemo } from 'react';
import '../styles/ResultsPage.css';

interface ResultsGridProps {
    totalQuestions: number;
    correctIndices: number[];
    incorrectIndices: number[];
    markedQuestions: Record<number, boolean>;
    onQuestionClick: (index: number) => void;
}

/**
 * Interactive map for spotting error clusters and jumping directly to review.
 */
const ResultsGrid: React.FC<ResultsGridProps> = ({
    totalQuestions,
    correctIndices,
    incorrectIndices,
    markedQuestions,
    onQuestionClick
}) => {
    //lookups to prevent render blocking on 100+ question tests.
    const { correctSet, incorrectSet } = useMemo(() => ({
        correctSet: new Set(correctIndices),
        incorrectSet: new Set(incorrectIndices)
    }), [correctIndices, incorrectIndices]);

    const gridCells = Array.from({ length: totalQuestions }, (_, i) => i);

    return (
        <div className="results-grid-container">
            <div className="results-grid-header">
                <h3>Question Breakdown</h3>
                <div className="results-grid-legend">
                    <span className="legend-item"><span className="legend-box correct"></span> Correct</span>
                    <span className="legend-item"><span className="legend-box incorrect"></span> Incorrect</span>
                    <span className="legend-item"><span className="legend-box skipped"></span> Skipped</span>
                    <span className="legend-item">🚩 Marked</span>
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