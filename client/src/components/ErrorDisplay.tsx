import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/App.css';

interface ErrorDisplayProps {
    error: string | Error;
    backLink?: string;
    backLinkText?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
    error, 
    backLink = '/app', 
    backLinkText = 'Go Home' 
}) => {
    const errorMessage = typeof error === 'string' ? error : (error?.message || 'An unexpected error occurred.');
    
    return (
        <div className="page-error" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <span>Error: {errorMessage}</span>
            <Link to={backLink} className="back-button" style={{ textDecoration: 'none' }}>
                {backLinkText}
            </Link>
        </div>
    );
};

export default ErrorDisplay;