import React from 'react';
import '../styles/ResumePromptModal.css';

interface ResumePromptModalProps {
    onResume: () => void;
    onStartNew: () => void;
}

const ResumePromptModal: React.FC<ResumePromptModalProps> = ({ onResume, onStartNew }) => {
    // This modal is not closable; the user must make a choice.
    const handleModalContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
                    <button onClick={onStartNew} className="rpm-button secondary">
                        Start Over
                    </button>
                    <button onClick={onResume} className="rpm-button primary">
                        Yes, Resume
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResumePromptModal;