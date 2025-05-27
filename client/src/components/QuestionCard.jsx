import React from 'react';
import '../styles/QuestionCard.css';

function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted, // This prop now reflects (actual submission OR S-key reveal OR review mode)
  showExplanation, // This prop now reflects (actual show OR S-key reveal OR review mode)
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode,
  isMarked,
  onOptionSelect,
  onViewAnswer, // This is effectively what S-key + Next button does
  onToggleExplanation,
  onToggleCrossOff,
  onToggleMark,
  isTemporarilyRevealed // NEW PROP: specifically for S-key state from QuizPage
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
    // Allow option selection only if not truly submitted, not in review, and not S-revealed
    if (!isSubmitted && !isReviewMode && !isTemporarilyRevealed && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault();
      // Allow crossing off only if not truly submitted, not in review, and not S-revealed
      if (!isSubmitted && !isReviewMode && !isTemporarilyRevealed) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { className += ' crossed-off'; }

    // isSubmitted prop is now true if (actual user submission OR S-key reveal OR review mode)
    if (isSubmitted) { // isSubmitted from props already incorporates tempReveal logic from QuizPage
        className += ' submitted';
        if (option.is_correct) {
            className += ' correct';
        } else if (option.label === selectedOption) { // Show user's incorrect choice
            className += ' incorrect';
        }
    } else if (option.label === selectedOption) { // Not submitted/revealed yet
      if (!crossedOffOptions.has(option.label)) {
        className += ' selected';
      }
    }
    // isReviewMode prop is also used by QuizPage to set isSubmitted to true for QuestionCard
    // if (isReviewMode) { className += ' review-mode'; } // This might be redundant
    return className;
  };

  const isErrorQuestion = !!questionData.error;
  // Use the showExplanation prop directly as it's controlled by QuizPage (which considers S-key, submission, review mode)
  const shouldShowExplanation = showExplanation && !!explanation.html_content;


  return (
    <div className={`question-card ${isErrorQuestion ? 'error-card' : ''}`}>
      {!isErrorQuestion ? (
        <>
          <div className="question-content">
            <p className="question-number">Question {questionIndex + 1}</p>
            <div className="question-html-content" dangerouslySetInnerHTML={{ __html: question.html_content || '<p>Question text missing.</p>' }} />
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
                  // Disable radio if answers are shown (isSubmitted includes S-key reveal) or in review mode
                  disabled={isSubmitted || isReviewMode || crossedOffOptions.has(option.label)}
                  className="option-radio"
                />
                <span className="option-label-text">
                    <span className="option-letter">{option.label}</span>
                    <div className="option-html-content" dangerouslySetInnerHTML={{ __html: option.html_content || '<p>Option text missing.</p>' }} />
                </span>
                {isSubmitted && !isReviewMode && option.percentage_selected && !isTemporarilyRevealed && ( // Hide percentage if S-revealed
                     <span className="option-percentage">{option.percentage_selected}</span>
                )}
              </label>
            ))}
          </div>

           <div className="action-buttons">
            {(isSubmitted || isReviewMode || isTemporarilyRevealed) && !!explanation.html_content && ( // Show button if explanation can be shown
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