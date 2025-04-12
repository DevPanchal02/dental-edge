import React from 'react';
import '../styles/PracticeTests.css';

// Extracts number from test name like "Test X of Y"
const getTestNumberFromName = (name) => {
    const match = name?.match(/^Test\s*(\d+)/i);
    return match ? match[1] : '?';
};

function PracticeTests({ topic, tests, isLoading, error }) {

  if (isLoading) {
    return <div className="practice-tests-loading">Loading tests...</div>;
  }

  if (error) {
    return <div className="practice-tests-error">Error loading tests: {error}</div>;
  }

  if (!tests || tests.length === 0) {
    return <p className="practice-tests-info">No practice tests available for {topic?.name || 'this topic'}. (Backend fetch is currently disabled).</p>;
  }

  return (
    <div className="practice-tests-container">
      {Array.isArray(tests) && tests.map((test) => (
        <button key={test.id} className="practice-test-item-button">
          <span className="test-number-circle">{getTestNumberFromName(test.name)}</span>
          <span className="test-name">{test.name || 'Unnamed Test'}</span>

          {(typeof test.score === 'number' && typeof test.total === 'number') ? (
            <div className="test-score-section">
              <span className="latest-score-label">Latest score</span>
              <div className="score-progress-bar">
                <div
                  className="score-progress-fill"
                  style={{ width: `${test.total > 0 ? (Math.max(0, test.score) / test.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="score-text">{`${test.score}/${test.total}`}</span>
            </div>
          ) : (
            <div className="test-score-section no-score"></div>
          )}
        </button>
      ))}
    </div>
  );
}

export default PracticeTests;