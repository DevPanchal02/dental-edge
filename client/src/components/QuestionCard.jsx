// FILE: client/src/components/QuestionCard.jsx
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
  isSubmitted,         // True if the answer for this question is submitted OR if in review/tempReveal
  showExplanation,     // Boolean flag from QuizPage to show explanation area
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode,        // True if the entire quiz is in review mode (e.g., from results page)
  isMarked,
  onOptionSelect,
  // onViewAnswer, // This was for QBank's "S" key, handled by tempReveal now
  onToggleExplanation,
  onToggleCrossOff,
  onToggleMark,
  isTemporarilyRevealed, // For QBank "Show Solution"
  isPracticeTestActive,  // New prop: true if it's an active (not review) practice test
}) {

   if (!questionData || typeof questionData !== 'object' || questionData === null) {
     // console.warn(`[QuestionCard] Invalid question data at index ${questionIndex}:`, questionData);
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
    const trulySubmitted = isPracticeTestActive ? false : (isSubmitted && !isReviewMode && !isTemporarilyRevealed);

    if (!trulySubmitted && !isReviewMode && !isTemporarilyRevealed && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

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
    
    // Determine if grading styles (correct/incorrect) should be shown
    const showGradingStyles = isReviewMode || isTemporarilyRevealed || (!isPracticeTestActive && isSubmitted);

    if (showGradingStyles) {
        className += ' submitted'; // General state for when grading is active
        if (option.is_correct) {
            className += ' correct';
        } else if (isThisOptionSelected) { // If this *wrong* option was selected
            className += ' incorrect';
        }
        // If it's the correct answer and also selected, 'correct' takes precedence.
        // If it's a wrong answer and selected, 'incorrect' is added.
        // If it's a wrong answer and NOT selected, no extra grading style.
    } else {
        // Active quiz state (not showing full grading)
        if (isThisOptionSelected) {
            className += ' selected';
        }
        // For QBank, 'submitted' class can apply even if not showing full grading yet (after user submits for that card)
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
                  checked={selectedOption === option.label && !crossedOffOptions.has(option.label)} // This correctly reflects selection
                  readOnly
                  disabled={
                    (isPracticeTestActive ? false : isSubmitted) || // For PT, options remain clickable until test ends
                    isReviewMode ||
                    crossedOffOptions.has(option.label) ||
                    isTemporarilyRevealed // QBank specific
                  }
                  className="option-radio"
                />
                <span className="option-label-text">
                    <span className="option-letter">{option.label}</span>
                    <HtmlRenderer className="option-html-content" htmlString={option.html_content} />
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