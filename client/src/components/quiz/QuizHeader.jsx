// FILE: client/src/components/quiz/QuizHeader.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronLeft } from 'react-icons/fa';
import '../../styles/QuizPage.css';

function QuizHeader({ title, progressText, backLink, backText, isPreviewMode }) {
    return (
        <div className="quiz-header">
            <div className="header-left">
                {isPreviewMode ? (
                    <Link to="/" className="back-button-quiz icon-button">
                        <FaChevronLeft /> Back to Home
                    </Link>
                ) : (
                    <Link to={backLink} className="back-button-quiz icon-button">
                        <FaChevronLeft /> {backText}
                    </Link>
                )}
            </div>
            <div className="header-center">
                {/* In preview mode, show "Dental Edge" branding above the title */}
                {isPreviewMode && <p className="pto-app-name" style={{ margin: '0 0 3px 0' }}>Dental Edge</p>}
                <h1 className="quiz-title">{title}</h1>
            </div>
            <div className="header-right">
                <p className="quiz-progress">
                    {progressText}
                </p>
            </div>
        </div>
    );
}

export default QuizHeader;