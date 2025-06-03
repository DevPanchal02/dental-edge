import React, { useState, useEffect } from 'react';
import '../styles/PracticeTestOptions.css';

const CloseIcon = () => (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.042 1.542 7.5 8m0 0L1.042 14.46M7.5 8l6.458-6.458M7.5 8l6.458 6.459" stroke="currentColor" strokeWidth="2.067" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
);

function PracticeTestOptions({
    isOpen,
    onClose,
    onStartTest,
    fullNameForDisplay,      // e.g., "Biology Practice Test 1" - from quizMetadata.fullNameForDisplay
    categoryForInstructions, // e.g., "Biology" - from quizMetadata.categoryForInstructions
    baseTimeLimitMinutes,    // e.g., 30 - calculated in QuizPage before passing
    numQuestions,            // e.g., 40 - from quizMetadata.totalQuestions
}) {
    const [prometricDelayEnabled, setPrometricDelayEnabled] = useState(false);
    const [additionalTimeEnabled, setAdditionalTimeEnabled] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            // setPrometricDelayEnabled(false); // Optionally reset on close
            // setAdditionalTimeEnabled(false);
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleStartClick = () => {
        onStartTest({
            prometricDelay: prometricDelayEnabled,
            additionalTime: additionalTimeEnabled,
        });
    };

    // Calculate actual time based on the "Additional Time" toggle
    const actualTimeLimitMinutes = additionalTimeEnabled && baseTimeLimitMinutes
        ? Math.round(baseTimeLimitMinutes * 1.5)
        : baseTimeLimitMinutes;

    const displayNumQuestions = numQuestions || "N/A";
    const displayCategory = categoryForInstructions || "Test";
    const displayTime = actualTimeLimitMinutes || "N/A";

    return (
        <div className="pto-modal-overlay">
            <div className="pto-modal-container">
                <div className="pto-modal-header">
                    <button onClick={onClose} className="pto-close-button" aria-label="Close">
                        <CloseIcon />
                    </button>
                    <div className="pto-header-title-group">
                        <p className="pto-app-name">DATPrep</p>
                        {/* Use fullNameForDisplay for the main title */}
                        <p className="pto-quiz-name">{fullNameForDisplay || 'Practice Test Options'}</p>
                    </div>
                    <div className="pto-header-spacer"></div>
                </div>

                <div className="pto-modal-body">
                    <div className="pto-instructions-section">
                        <p>Please read the following instructions carefully.</p>
                        <ul>
                            {/* Updated instruction line */}
                            <li>You will have {displayTime} minutes to complete {displayNumQuestions} {displayCategory} questions.</li>
                            <li>Your test score will be shown at the end, along with answers and explanations.</li>
                            <li>The test cannot be paused once started to simulate the real exam experience.</li>
                            <li>Use the "Mark" button to flag questions for later review.</li>
                            <li>Right-click on an option to cross it out.</li>
                        </ul>
                    </div>

                    <div className="pto-options-section">
                        <div className="pto-option">
                            <label className="pto-switch">
                                <input
                                    type="checkbox"
                                    checked={prometricDelayEnabled}
                                    onChange={() => setPrometricDelayEnabled(!prometricDelayEnabled)}
                                />
                                <span className="pto-slider"></span>
                            </label>
                            <div className="pto-option-description">
                                <b>Prometric Delay:</b> Simulate the official DAT experience with a 2-second delay between questions and when navigating review sections.
                            </div>
                        </div>
                        <div className="pto-option">
                            <label className="pto-switch">
                                <input
                                    type="checkbox"
                                    checked={additionalTimeEnabled}
                                    onChange={() => setAdditionalTimeEnabled(!additionalTimeEnabled)}
                                />
                                <span className="pto-slider"></span>
                            </label>
                            <div className="pto-option-description">
                                <b>Additional Time:</b> Enable 1.5x time for users with CDA-approved special accommodations.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pto-modal-footer">
                    <button onClick={handleStartClick} className="pto-start-button">
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PracticeTestOptions;