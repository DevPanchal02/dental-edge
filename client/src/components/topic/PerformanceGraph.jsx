import React from 'react';

function PerformanceGraph({ questions, userAttempt }) {
    return (
        <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)',
            marginBottom: '30px'
        }}>
            <h3 style={{ marginTop: 0 }}>Performance Graph</h3>
            <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
                <p>Graph will be rendered here.</p>
            </div>
        </div>
    );
}

export default PerformanceGraph;