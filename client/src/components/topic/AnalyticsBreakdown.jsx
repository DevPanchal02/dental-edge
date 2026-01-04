// FILE: client/src/components/topic/AnalyticsBreakdown.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/AnalyticsBreakdown.css'; // <-- Import the new stylesheet

function AnalyticsBreakdown({ userAttempt }) {
    return (
        <div className="breakdown-container">
            <div className="breakdown-header">
                <h3 className="breakdown-title">Analytics Breakdown</h3>
            </div>
            
            <div className="breakdown-placeholder">
                <p>Detailed stats will be rendered here.</p>
            </div>

            {userAttempt && (
                <div className="view-attempt-button-container">
                    <Link 
                        to={`/app/quiz/${userAttempt.topicId}/${userAttempt.sectionType}/${userAttempt.quizId}`}
                        state={{ attemptId: userAttempt.id }} // Pass attemptId for review mode
                        className="view-attempt-button"
                    >
                        View Attempt
                    </Link>
                </div>
            )}
        </div>
    );
}

export default AnalyticsBreakdown;