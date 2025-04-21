// FILE: client/src/components/ReviewModal.jsx
import React from 'react';
import '../styles/ReviewModal.css';

function ReviewModal({
    isOpen,
    onClose,
    questions,
    markedQuestions,
    submittedAnswers,
    onJumpToQuestion,
    currentQuestionIndex,
    onFinishQuiz // NEW PROP for ending the quiz
}) {
    if (!isOpen) {
        return null;
    }

    const handleJump = (index) => {
        onJumpToQuestion(index);
        onClose(); // Close modal after jumping
    };

    // Stop background scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>×</button>
                <h2>Review Questions</h2>
                <div className="modal-question-list">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Status</th>
                                <th>Marked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {questions.map((q, index) => {
                                const isMarked = !!markedQuestions[index];
                                const isSubmitted = !!submittedAnswers[index];
                                const isCurrent = index === currentQuestionIndex;
                                if (!q || q.error) return null; // Skip error placeholders

                                return (
                                    <tr key={index} className={isCurrent ? 'current-question-row' : ''}>
                                        <td>
                                            <button
                                                className="jump-button"
                                                onClick={() => handleJump(index)}
                                                title={`Jump to Question ${index + 1}`}
                                            >
                                                {index + 1}
                                            </button>
                                        </td>
                                        <td>
                                            {isSubmitted ? (
                                                <span className="status-answered" title="Answered">✓ Answered</span>
                                            ) : (
                                                <span className="status-unanswered" title="Not Answered">○ Unanswered</span>
                                            )}
                                        </td>
                                        <td>
                                            {isMarked ? (
                                                <span className="status-marked" title="Marked for Review">🚩</span>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {/* --- NEW: Finish Button inside Modal --- */}
                <div className="modal-actions">
                    <button
                        className="modal-finish-button"
                        onClick={() => {
                            onFinishQuiz(false); // Call the finish handler (false = not timed out)
                            onClose(); // Close the modal
                        }}
                    >
                        End Quiz & View Results
                    </button>
                </div>
                 {/* --- End NEW --- */}
            </div>
        </div>
    );
}

export default ReviewModal;