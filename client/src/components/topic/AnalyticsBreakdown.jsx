import React from 'react';
import { Link } from 'react-router-dom';

function AnalyticsBreakdown({ userAttempt }) {
    return (
        <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)'
        }}>
            <h3 style={{ marginTop: 0 }}>Analytics Breakdown</h3>
            <div style={{ color: 'var(--text-secondary)' }}>
                <p>Detailed stats will be rendered here.</p>
                {userAttempt && (
                    <div style={{ marginTop: '20px' }}>
                        <Link 
                            to={`/app/quiz/${userAttempt.topicId}/${userAttempt.sectionType}/${userAttempt.quizId}`}
                            state={{ attemptId: userAttempt.id, review: true }}
                            style={{
                                padding: '10px 15px',
                                backgroundColor: 'var(--bg-button-primary)',
                                color: 'var(--text-on-button-primary)',
                                borderRadius: '6px',
                                textDecoration: 'none'
                            }}
                        >
                            View Attempt
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AnalyticsBreakdown;