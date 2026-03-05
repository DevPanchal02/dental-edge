import React, { useMemo } from 'react';
import '../../styles/AnalyticsBreakdown.css';
import { QuizAttempt, Question } from '../../types/quiz.types';

interface AnalyticsBreakdownProps {
    userAttempt: QuizAttempt | null | undefined;
    questions: Question[];
    mode?: 'category' | 'difficulty' | 'auto';
    onReviewSequence?: (indices: number[]) => void;
}

const AnalyticsBreakdown: React.FC<AnalyticsBreakdownProps> = ({ 
    userAttempt, 
    questions,
    mode = 'auto',
    onReviewSequence
}) => {
    
    // --- Data Processing & View Logic ---
    const { displayMode, breakdownStats } = useMemo(() => {
        if (!questions.length || !userAttempt) return { displayMode: 'category', breakdownStats:[] };

        // 1. Determine the context of the quiz (Auto or Explicit)
        let resolvedMode = mode;
        if (resolvedMode === 'auto') {
            const uniqueCategories = new Set(questions.map(q => q.category?.trim() || 'General'));
            resolvedMode = uniqueCategories.size > 1 ? 'category' : 'difficulty';
        }

        // Helper to bucket questions by peer success rate
        const getDifficultyLabel = (percentStr?: string) => {
            const val = parseFloat(percentStr || '50');
            if (val >= 75) return 'Easy (≥ 75% Peer Accuracy)';
            if (val >= 45) return 'Medium (45% - 74% Peer Accuracy)';
            return 'Hard (< 45% Peer Accuracy)';
        };

        const stats: Record<string, { total: number; userCorrect: number; sumAverage: number; indices: number[] }> = {};

        // 2. Aggregate data based on the resolved mode
        questions.forEach((q, index) => {
            const groupKey = resolvedMode === 'category' 
                ? (q.category ? q.category.trim() : 'General')
                : getDifficultyLabel(q.analytics?.percent_correct);
            
            if (!stats[groupKey]) {
                stats[groupKey] = { total: 0, userCorrect: 0, sumAverage: 0, indices: [] };
            }

            stats[groupKey].total++;
            stats[groupKey].indices.push(index);
            
            const userAnswer = userAttempt.userAnswers[index];
            const correctOption = q.options.find(o => o.is_correct);
            
            if (userAnswer && correctOption && userAnswer === correctOption.label) {
                stats[groupKey].userCorrect++;
            }

            const avg = parseFloat(q.analytics?.percent_correct || '0');
            stats[groupKey].sumAverage += avg;
        });

        // 3. Format and Sort the Output
        const formattedStats = Object.entries(stats).map(([key, data]) => ({
            label: key,
            userPercent: (data.userCorrect / data.total) * 100,
            avgPercent: data.sumAverage / data.total,
            indices: data.indices
        }));

        if (resolvedMode === 'category') {
            formattedStats.sort((a, b) => a.label.localeCompare(b.label)); // Alphabetical
        } else {
            // Force Difficulty Order: Hard -> Medium -> Easy
            const sortOrder: Record<string, number> = {
                'Hard (< 45% Peer Accuracy)': 1,
                'Medium (45% - 74% Peer Accuracy)': 2,
                'Easy (≥ 75% Peer Accuracy)': 3
            };
            formattedStats.sort((a, b) => sortOrder[a.label] - sortOrder[b.label]);
        }

        return { displayMode: resolvedMode, breakdownStats: formattedStats };

    }, [questions, userAttempt, mode]);

    // --- Render ---

    if (!userAttempt || !questions.length) {
        return (
            <div className="breakdown-container-transparent">
                <div className="breakdown-header-simple">
                    <h3 className="breakdown-title">Performance Breakdown</h3>
                </div>
                <div className="breakdown-placeholder">
                    <p>Select a completed test to view analytics.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="breakdown-container-transparent">
            <div className="breakdown-header-simple">
                <h3 className="breakdown-title">
                    {displayMode === 'category' ? 'Category Breakdown' : 'Difficulty Breakdown'}
                </h3>
            </div>
            
            <div className="breakdown-content">
                {breakdownStats.map((stat) => {
                    const isInteractive = !!onReviewSequence;
                    const isDisabled = isInteractive && stat.indices.length === 0;
                    
                    const hoverTitle = isInteractive
                        ? (isDisabled 
                            ? `No questions found for ${stat.label}` 
                            : `Review ${stat.indices.length} questions in ${stat.label}`)
                        : undefined;

                    // Common content for the row
                    const RowContent = (
                        <>
                            <div className="category-label">{stat.label}</div>
                            <div className="bar-container">
                                {/* User Score Bar */}
                                <div className="bar-group">
                                    <div className="bar-info">
                                        <span className="bar-label">You</span>
                                        <span className="bar-percent">{stat.userPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <div 
                                            className="progress-fill user-fill" 
                                            style={{ width: `${stat.userPercent}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Average Score Bar */}
                                <div className="bar-group">
                                    <div className="bar-info">
                                        <span className="bar-label">Average</span>
                                        <span className="bar-percent">{stat.avgPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <div 
                                            className="progress-fill avg-fill" 
                                            style={{ width: `${stat.avgPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    );

                    // Render as Button if interactive (Results Page), Div if not (Topic Page)
                    return isInteractive ? (
                        <button 
                            key={stat.label}
                            className={`category-row interactive ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && onReviewSequence && onReviewSequence(stat.indices)}
                            disabled={isDisabled}
                            title={hoverTitle}
                            aria-label={hoverTitle}
                        >
                            {RowContent}
                        </button>
                    ) : (
                        <div key={stat.label} className="category-row">
                            {RowContent}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(AnalyticsBreakdown);