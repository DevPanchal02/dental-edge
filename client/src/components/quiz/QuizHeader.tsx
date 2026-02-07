import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronLeft } from 'react-icons/fa';
import '../../styles/QuizPage.css';

/**
 * Defines the strict contract for the Header.
 * We avoid optional props (?) here to ensure the UI is always deterministic.
 */
interface QuizHeaderProps {
    title: string;
    progressText: string;
    backLink: string;
    backText: string;
    isPreviewMode: boolean;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({ 
    title, 
    progressText, 
    backLink, 
    backText, 
    isPreviewMode 
}) => {
    return (
        <div className="quiz-header">
            <div className="header-left">
                {/* 
                   Conditional rendering based on 'isPreviewMode' flag.
                   In a larger app, we might separate 'GuestHeader' and 'UserHeader' 
                   into different components, but for this complexity, a ternary is efficient.
                */}
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
};

export default QuizHeader;