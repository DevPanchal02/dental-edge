// FILE: client/src/components/ResumePromptModal.jsx

import React from 'react';
import '../styles/ResumePromptModal.css'; // <-- Import the new dedicated stylesheet

function ResumePromptModal({ onResume, onStartNew }) {
    // This modal is not closable; the user must make a choice.
    const handleModalContentClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div className="rpm-overlay">
            <div className="rpm-container" onClick={handleModalContentClick}>
                <div className="rpm-header">
                    <h2 className="rpm-title">Welcome Back!</h2>
                    <p className="rpm-subtitle">
                        You have a quiz in progress. Would you like to continue where you left off?
                    </p>
                </div>

                <div className="rpm-actions">
                    {/* The "Start Over" button now has the 'secondary' class */}
                    <button onClick={onStartNew} className="rpm-button secondary">
                        Start Over
                    </button>
                    {/* The "Resume" button now has the 'primary' class */}
                    <button onClick={onResume} className="rpm-button primary">
                        Yes, Resume
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ResumePromptModal;