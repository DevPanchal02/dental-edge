import React, { useMemo } from 'react';
import '../../styles/AnalyticsBreakdown.css';
import { QuizAttempt, Question } from '../../types/quiz.types';

interface AnalyticsBreakdownProps {
    userAttempt: QuizAttempt | null | undefined;
    questions: Question[];
    // Optional because TopicPage uses this component without these props
    categoryIndices?: Record<string, number[]>;
    onReviewSequence?: (indices: number[]) => void;
}

const AnalyticsBreakdown: React.FC<AnalyticsBreakdownProps> = ({ 
    userAttempt, 
    questions,
    categoryIndices,
    onReviewSequence
}) => {
    
    // --- Data Processing ---
    const categoryStats = useMemo(() => {
        if (!questions.length || !userAttempt) return [];

        const stats: Record<string, { total: number; userCorrect: number; sumAverage: number }> = {};

        questions.forEach((q, index) => {
            const category = q.category ? q.category.trim() : 'General';
            
            if (!stats[category]) {
                stats[category] = { total: 0, userCorrect: 0, sumAverage: 0 };
            }

            stats[category].total++;
            
            const userAnswer = userAttempt.userAnswers[index];
            const correctOption = q.options.find(o => o.is_correct);
            
            if (userAnswer && correctOption && userAnswer === correctOption.label) {
                stats[category].userCorrect++;
            }

            const avg = parseFloat(q.analytics?.percent_correct || '0');
            stats[category].sumAverage += avg;
        });

        return Object.entries(stats).map(([cat, data]) => ({
            category: cat,
            userPercent: (data.userCorrect / data.total) * 100,
            avgPercent: data.sumAverage / data.total
        })).sort((a, b) => a.category.localeCompare(b.category));

    }, [questions, userAttempt]);

    // --- Render ---

    if (!userAttempt || !questions.length) {
        return (
            <div className="breakdown-container-transparent">
                <div className="breakdown-header-simple">
                    <h3 className="breakdown-title">Category Breakdown</h3>
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
                <h3 className="breakdown-title">Category Breakdown</h3>
            </div>
            
            <div className="breakdown-content">
                {categoryStats.map((stat) => {
                    // Determine interactivity
                    const indices = categoryIndices ? (categoryIndices[stat.category] || []) : [];
                    const isInteractive = !!onReviewSequence && !!categoryIndices;
                    const isDisabled = isInteractive && indices.length === 0;
                    
                    const hoverTitle = isInteractive
                        ? (isDisabled 
                            ? `No questions found for ${stat.category}` 
                            : `Review ${indices.length} questions in ${stat.category}`)
                        : undefined;

                    // Common content for the row
                    const RowContent = (
                        <>
                            <div className="category-label">{stat.category}</div>
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

                    // Render as Button if interactive, Div if not
                    return isInteractive ? (
                        <button 
                            key={stat.category}
                            className={`category-row interactive ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && onReviewSequence && onReviewSequence(indices)}
                            disabled={isDisabled}
                            title={hoverTitle}
                            aria-label={hoverTitle}
                        >
                            {RowContent}
                        </button>
                    ) : (
                        <div key={stat.category} className="category-row">
                            {RowContent}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(AnalyticsBreakdown);