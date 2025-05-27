import React from 'react';
import '../styles/QuestionCard.css';

// Memoized component for rendering HTML content
const HtmlRenderer = React.memo(function HtmlRenderer({ htmlString, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: htmlString || '<p>Content missing.</p>' }} />;
});


function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted,
  showExplanation,
  crossedOffOptions, // This is a Set
  userTimeSpentOnQuestion,
  isReviewMode,
  isMarked,
  onOptionSelect,
  onViewAnswer, 
  onToggleExplanation,
  onToggleCrossOff,
  onToggleMark,
  isTemporarilyRevealed
}) {

   if (!questionData || typeof questionData !== 'object' || questionData === null) {
     console.warn(`[QuestionCard] Invalid question data at index ${questionIndex}:`, questionData);
     return ( <div className="question-card error-card"><p className="error-message">Error displaying Question {questionIndex + 1}: Invalid data format.</p></div> );
   }
   if (questionData.error) {
    return ( <div className="question-card error-card"><p className="error-message">Error loading Question {questionIndex + 1}:<br /><span className="error-details">{questionData.error}</span></p></div> );
  }

  const {
      question = { html_content: '<p>Question content missing.</p>' },
      options = [],
      correct_answer_original_text = 'N/A',
      explanation = { html_content: '<p>Explanation not available.</p>' },
      analytics = { percent_correct: 'N/A', time_spent: 'N/A' }
  } = questionData;

  const handleSelect = (optionLabel) => {
    if (!isSubmitted && !isReviewMode && !isTemporarilyRevealed && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault();
      if (!isSubmitted && !isReviewMode && !isTemporarilyRevealed) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { className += ' crossed-off'; }

    if (isSubmitted) { 
        className += ' submitted';
        if (option.is_correct) {
            className += ' correct';
        } else if (option.label === selectedOption) { 
            className += ' incorrect';
        }
    } else if (option.label === selectedOption) { 
      if (!crossedOffOptions.has(option.label)) {
        className += ' selected';
      }
    }
    return className;
  };

  const isErrorQuestion = !!questionData.error;
  const shouldShowExplanation = showExplanation && !!explanation.html_content;

  return (
    <div className={`question-card ${isErrorQuestion ? 'error-card' : ''}`}>
      {!isErrorQuestion ? (
        <>
          <div className="question-content">
            <p className="question-number">Question {questionIndex + 1}</p>
            {/* Use HtmlRenderer for question content */}
            <HtmlRenderer className="question-html-content" htmlString={question.html_content} />
          </div>

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
                    {/* Use HtmlRenderer for option content */}
                    <HtmlRenderer className="option-html-content" htmlString={option.html_content} />
                </span>
                {isSubmitted && !isReviewMode && option.percentage_selected && !isTemporarilyRevealed && (
                     <span className="option-percentage">{option.percentage_selected}</span>
                )}
              </label>
            ))}
          </div>

           <div className="action-buttons">
            {(isSubmitted || isReviewMode || isTemporarilyRevealed) && !!explanation.html_content && (
              <button onClick={() => onToggleExplanation(questionIndex)} className="explanation-button">
                {showExplanation ? 'Hide' : 'Show'} Explanation 
              </button>
            )}
          </div>
          
          {shouldShowExplanation && (
            <div className="explanation-section">
              <h3 className="explanation-title">Explanation</h3>
              <div className="explanation-content">
                <p><strong>Correct Answer:</strong> {correct_answer_original_text}</p>
                {/* Use HtmlRenderer for explanation content */}
                <HtmlRenderer className="explanation-html-content" htmlString={explanation.html_content} />
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

export default React.memo(QuestionCard);