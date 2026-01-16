import React from 'react';
import '../styles/App.css';

interface LoadingSpinnerProps {
    message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => {
    return (
        <div className="page-loading">
            {message}
        </div>
    );
};

export default LoadingSpinner;