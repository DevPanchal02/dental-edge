// FILE: client/src/components/LoadingSpinner.jsx

import React from 'react';
import '../styles/App.css'; // Reusing global styles

function LoadingSpinner({ message = 'Loading...' }) {
    // We can use the existing page-loading style for consistency.
    // If we want a more complex spinner later, we can add styles here.
    return (
        <div className="page-loading">
            {message}
        </div>
    );
}

export default LoadingSpinner;