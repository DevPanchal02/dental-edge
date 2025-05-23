// FILE: client/src/components/QuestionCard.jsx
import React from 'react';
import '../styles/QuestionCard.css';

// The renderPoeText helper is likely no longer needed if POE is part of the explanation's HTML content.
// We'll remove it for now. If your scraper outputs POE as a separate HTML block that needs special styling
// you might re-introduce a similar helper or style it via CSS targeting classes within the explanation HTML.

function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted,
  showExplanation,
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode,
  isMarked, // Keep prop
  onOptionSelect,
  onViewAnswer,
  onToggleExplanation,
  onToggleCrossOff,
  onToggleMark // Keep prop
}) {

   if (!questionData || typeof questionData !== 'object' || questionData === null) {
     console.warn(`[QuestionCard] Invalid question data at index ${questionIndex}:`, questionData);
     return ( <div className="question-card error-card"><p className="error-message">Error displaying Question {questionIndex + 1}: Invalid data format.</p></div> );
   }
   if (questionData.error) {
    return ( <div className="question-card error-card"><p className="error-message">Error loading Question {questionIndex + 1}:<br /><span className="error-details">{questionData.error}</span></p></div> );
  }

  // Destructure safely, providing defaults
  const {
      question = { html_content: '<p>Question content missing.</p>' }, // Expect html_content
      options = [],
      correct_answer_original_text = 'N/A', // Updated field name
      explanation = { html_content: '<p>Explanation not available.</p>' }, // Expect html_content
      analytics = { percent_correct: 'N/A', time_spent: 'N/A' }
  } = questionData;


  const handleSelect = (optionLabel) => {
    if (!isSubmitted && !isReviewMode && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault();
      if (!isSubmitted && !isReviewMode) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { className += ' crossed-off'; }
    if (isSubmitted || isReviewMode) {
        className += ' submitted';
        if (option.is_correct) { className += ' correct'; }
        else if (option.label === selectedOption) { className += ' incorrect'; }
    } else if (option.label === selectedOption) {
      if (!crossedOffOptions.has(option.label)) { className += ' selected'; }
    }
    if (isReviewMode) { className += ' review-mode'; }
    return className;
  };

  const isErrorQuestion = !!questionData.error;

  return (
    <div className={`question-card ${isErrorQuestion ? 'error-card' : ''}`}>
      {!isErrorQuestion ? (
        <>
          {/* Question Content */}
          <div className="question-content">
            <p className="question-number">Question {questionIndex + 1}</p>
            {/* Render question HTML content */}
            <div className="question-html-content" dangerouslySetInnerHTML={{ __html: question.html_content || '<p>Question text missing.</p>' }} />
          </div>

          {/* Options */}
          <div className="options-container">
            {Array.isArray(options) && options.map((option) => (
              <label
                key={option.label}
                className={getOptionClassName(option)}
                onContextMenu={(e) => handleContextMenu(e, option.label)}
                onClick={() => handleSelect(option.label)}
              >
                <input
                  type="radio"
                  name={`question-${questionIndex}`}
                  value={option.label}
                  checked={selectedOption === option.label && !crossedOffOptions.has(option.label)}
                  readOnly
                  disabled={isSubmitted || isReviewMode || crossedOffOptions.has(option.label)}
                  className="option-radio"
                />
                <span className="option-label-text">
                    <span className="option-letter">{option.label}</span>
                    {/* Render option HTML content */}
                    <div className="option-html-content" dangerouslySetInnerHTML={{ __html: option.html_content || '<p>Option text missing.</p>' }} />
                </span>
                {isSubmitted && !isReviewMode && option.percentage_selected && (
                     <span className="option-percentage">{option.percentage_selected}</span>
                )}
              </label>
            ))}
          </div>

           {/* Action Buttons inside card - NOW ONLY EXPLANATION */}
           <div className="action-buttons">
            {(isSubmitted || isReviewMode) && !!explanation && (
              <button onClick={() => onToggleExplanation(questionIndex)} className="explanation-button">
                {showExplanation ? 'Hide' : 'Show'} Explanation
              </button>
            )}
          </div>

          {/* Explanation Section */}
          {(showExplanation || (isReviewMode && !!explanation)) && (
            <div className="explanation-section">
              <h3 className="explanation-title">Explanation</h3>
              <div className="explanation-content">
                <p><strong>Correct Answer:</strong> {correct_answer_original_text}</p> {/* Use new field name */}
                {/* Render explanation HTML content */}
                <div className="explanation-html-content" dangerouslySetInnerHTML={{ __html: explanation.html_content || '<p>Explanation details not available.</p>' }} />
              </div>
               <div className="analytics-section">
                    <h4>Analytics</h4>
                     <p>Time Spent: {
                        userTimeSpentOnQuestion !== undefined
                            ? `${userTimeSpentOnQuestion}s`
                            : (analytics?.time_spent || 'N/A')
                     }</p>
                    <p>Percent Correct (Average): {analytics.percent_correct || 'N/A'}</p>
                    {(questionData.category || analytics?.category) && <p>Category: {questionData.category || analytics.category}</p>}
                </div>
            </div>
          )}
        </>
      ) : (
        <p className="error-message">Error loading Question {questionIndex + 1}:<br /><span className="error-details">{questionData.error}</span></p>
      )}
    </div>
  );
}

export default QuestionCard;  