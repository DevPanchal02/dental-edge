import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/AnalyticsBreakdown.css';
import { QuizAttempt } from '../../types/quiz.types';

interface AnalyticsBreakdownProps {
    userAttempt: QuizAttempt | null | undefined;
}

const AnalyticsBreakdown: React.FC<AnalyticsBreakdownProps> = ({ userAttempt }) => {
    return (
        <div className="breakdown-container">
            <div className="breakdown-header">
                <h3 className="breakdown-title">Analytics Breakdown</h3>
            </div>
            
            <div className="breakdown-placeholder">
                <p>Detailed stats will be rendered here.</p>
            </div>

            {userAttempt && userAttempt.id && (
                <div className="view-attempt-button-container">
                    <Link 
                        to={`/app/quiz/${userAttempt.topicId}/${userAttempt.sectionType}/${userAttempt.quizId}`}
                        state={{ attemptId: userAttempt.id }}
                        className="view-attempt-button"
                    >
                        View Attempt
                    </Link>
                </div>
            )}
        </div>
    );
};

export default React.memo(AnalyticsBreakdown);