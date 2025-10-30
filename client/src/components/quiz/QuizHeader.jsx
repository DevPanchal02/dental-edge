// FILE: client/src/components/quiz/QuizHeader.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronLeft } from 'react-icons/fa';
import '../../styles/QuizPage.css'; // We can reuse some styles

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
                <h1 className="quiz-title">{title}</h1>
            </div>
            <div className="header-right">
                <p className="quiz-progress">
                    {progressText} {isPreviewMode && '(Preview)'}
                </p>
            </div>
        </div>
    );
}

export default QuizHeader;