// FILE: client/src/components/QuestionCard.jsx

import React from 'react';
import '../styles/QuestionCard.css';

// Memoized component for rendering HTML content
const HtmlRenderer = React.memo(function HtmlRenderer({ htmlString, className, ...rest }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: htmlString || '<p>Content missing.</p>' }} {...rest} />;
});

function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted,         // True if the answer for this question is submitted OR if in review/tempReveal
  showExplanation,     // Boolean flag from QuizPage to show explanation area
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode,        // True if the entire quiz is in review mode (e.g., from results page)
  isMarked,
  onOptionSelect,
  onToggleExplanation,
  onToggleCrossOff,
  onToggleMark,
  isTemporarilyRevealed, // For QBank "Show Solution"
  isPracticeTestActive,  // New prop: true if it's an active (not review) practice test
  highlightedHtml,       // New prop for persistent highlights
}) {

   if (!questionData || typeof questionData !== 'object' || questionData === null) {
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

  const getDisplayHtml = (originalHtml, contentKey) => {
    return highlightedHtml && highlightedHtml[contentKey] !== undefined
      ? highlightedHtml[contentKey]
      : originalHtml;
  };

  // --- HANDLER UPDATE START ---
  // Ensure the function signature accepts 'e' (event) as the first argument
  const handleSelect = (e, optionLabel) => {
    // Prevent default browser behavior to stop double-firing events (once on label, once on input)
    if (e && e.preventDefault) e.preventDefault();

    const trulySubmitted = isPracticeTestActive ? false : (isSubmitted && !isReviewMode && !isTemporarilyRevealed);

    if (!trulySubmitted && !isReviewMode && !isTemporarilyRevealed && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };
  // --- HANDLER UPDATE END ---

  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault();
      const trulySubmittedForCrossOff = isPracticeTestActive ? false : (isSubmitted && !isReviewMode && !isTemporarilyRevealed);
      if (!trulySubmittedForCrossOff && !isReviewMode && !isTemporarilyRevealed) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { className += ' crossed-off'; }

    const isThisOptionSelected = option.label === selectedOption && !crossedOffOptions.has(option.label);
    
    const showGradingStyles = isReviewMode || isTemporarilyRevealed || (!isPracticeTestActive && isSubmitted);

    if (showGradingStyles) {
        className += ' submitted'; 
        if (option.is_correct) {
            className += ' correct';
        } else if (isThisOptionSelected) { 
            className += ' incorrect';
        }
    } else {
        if (isThisOptionSelected) {
            className += ' selected';
        }
        if (isSubmitted && !isPracticeTestActive) { 
             className += ' submitted';
        }
    }
    return className;
  };

  const isErrorQuestion = !!questionData.error;

  const canShowExplanationButton =
    !!explanation.html_content &&
    (isReviewMode || isTemporarilyRevealed || (!isPracticeTestActive && isSubmitted));

  const shouldRenderExplanationContent = canShowExplanationButton && showExplanation;

  return (
    <div className={`question-card ${isErrorQuestion ? 'error-card' : ''}`}>
      {!isErrorQuestion ? (
        <>
          <div className="question-content">
            <p className="question-number">Question {questionIndex + 1}</p>
            <HtmlRenderer
              className="question-html-content"
              htmlString={getDisplayHtml(question.html_content, `question_${questionIndex}`)}
              data-content-key={`question_${questionIndex}`}
            />
          </div>

          <div className="options-container">
            {Array.isArray(options) && options.map((option) => (
              <label
                key={option.label}
                className={getOptionClassName(option)}
                onContextMenu={(e) => handleContextMenu(e, option.label)}
                // --- JSX UPDATE: Pass 'e' explicitly ---
                onClick={(e) => handleSelect(e, option.label)}
              >
                <input
                  type="radio"
                  name={`question-${questionIndex}`}
                  value={option.label}
                  checked={selectedOption === option.label && !crossedOffOptions.has(option.label)}
                  readOnly
                  disabled={
                    (isPracticeTestActive ? false : isSubmitted) || 
                    isReviewMode ||
                    crossedOffOptions.has(option.label) ||
                    isTemporarilyRevealed
                  }
                  className="option-radio"
                />
                <span className="option-label-text">
                    <span className="option-letter">{option.label}</span>
                    <HtmlRenderer
                      className="option-html-content"
                      htmlString={getDisplayHtml(option.html_content, `option_${questionIndex}_${option.label}`)}
                      data-content-key={`option_${questionIndex}_${option.label}`}
                    />
                </span>
                {isSubmitted && (!isPracticeTestActive || isTemporarilyRevealed || isReviewMode) && option.percentage_selected && (
                     <span className="option-percentage">{option.percentage_selected}</span>
                )}
              </label>
            ))}
          </div>

           <div className="action-buttons">
            {canShowExplanationButton && (
              <button onClick={() => onToggleExplanation(questionIndex)} className="explanation-button">
                {showExplanation ? 'Hide' : 'Show'} Explanation
              </button>
            )}
          </div>

          {shouldRenderExplanationContent && (
            <div className="explanation-section">
              <h3 className="explanation-title">Explanation</h3>
              <div className="explanation-content">
                <p><strong>Correct Answer:</strong> {correct_answer_original_text}</p>
                <HtmlRenderer
                  className="explanation-html-content"
                  htmlString={getDisplayHtml(explanation.html_content, `explanation_${questionIndex}`)}
                  data-content-key={`explanation_${questionIndex}`}
                />
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
