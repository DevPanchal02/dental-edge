// FILE: client/src/components/QuestionCard.jsx
import React from 'react';
import '../styles/QuestionCard.css';

// Helper to safely render POE text
const renderPoeText = (poeText) => {
    if (!poeText || typeof poeText !== 'string') {
        return <p>Process of elimination not available.</p>;
    }
    const parts = poeText.split(/(Option\s+[A-Z]\s*\.)/i);
    return parts.filter(part => part?.trim()).map((part, index) => {
        const isHeader = /Option\s+[A-Z]\s*\./i.test(part);
        if (isHeader) {
            return <strong key={`poe-header-${index}`} className="poe-header">{part.trim()}</strong>;
        } else {
             const previousPartIndex = parts.slice(0, index).findLastIndex(p => p?.trim());
             const previousPartIsHeader = previousPartIndex !== -1 && /Option\s+[A-Z]\s*\./i.test(parts[previousPartIndex]);
             if (index === 0 || previousPartIsHeader) {
                return <p key={`poe-text-${index}`} className="poe-text">{part.trim()}</p>;
             }
             return null;
        }
    });
};


function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted, // This will be true if already submitted OR if in review mode
  showExplanation, // This will be true if submitted and toggled OR if in review mode
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode, // NEW PROP
  onOptionSelect,
  onSubmit,
  onToggleExplanation,
  onToggleCrossOff
}) {

   if (!questionData || typeof questionData !== 'object' || questionData === null) {
     console.warn(`[QuestionCard] Invalid question data at index ${questionIndex}:`, questionData);
     return ( <div className="question-card error-card"><p className="error-message">Error displaying Question {questionIndex + 1}: Invalid data format.</p></div> );
   }
  if (questionData.error) {
    return ( <div className="question-card error-card"><p className="error-message">Error loading Question {questionIndex + 1}:<br /><span className="error-details">{questionData.error}</span></p></div> );
  }

  const {
      question = { text: 'Question text missing.', images: [] },
      options = [],
      correct_answer_text = 'N/A',
      explanation = { concept_text: '', poe_text: '', images: [] },
      analytics = { percent_correct: 'N/A', time_spent: 'N/A' }
  } = questionData;


  const handleSelect = (optionLabel) => {
    // Only allow selecting if NOT submitted and NOT in review mode
    if (!isSubmitted && !isReviewMode && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault();
      // Only allow crossing off if NOT submitted and NOT in review mode
      if (!isSubmitted && !isReviewMode) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    // Apply crossed-off style first if applicable (even in review mode)
    if (crossedOffOptions.has(option.label)) {
        className += ' crossed-off';
    }
    // Apply submitted styles (correct/incorrect) if submitted OR in review mode
    if (isSubmitted || isReviewMode) {
        className += ' submitted';
        if (option.is_correct) {
            className += ' correct';
        } else if (option.label === selectedOption) { // Highlight incorrect selection
            className += ' incorrect';
        }
    } else if (option.label === selectedOption) { // Apply selected style only if active and not crossed-off
      if (!crossedOffOptions.has(option.label)) {
          className += ' selected';
      }
    }
    // Add review-mode class for potential specific styling
    if (isReviewMode) {
        className += ' review-mode';
    }
    return className;
  };

  return (
    <div className="question-card">
      <div className="question-content">
        <p className="question-number">Question {questionIndex + 1}</p>
        <p className="question-text">{question.text}</p>
        {question.images && question.images.length > 0 && (
          <div className="question-images">
            {question.images.map((imgSrc, index) => (
              <img key={index} src={imgSrc} alt={`Question ${questionIndex + 1} image ${index + 1}`} />
            ))}
          </div>
        )}
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
              disabled={isSubmitted || isReviewMode || crossedOffOptions.has(option.label)} // Disable in review or if submitted/crossed
              className="option-radio"
            />
            <span className="option-label-text">
                <span className="option-letter">{option.label}</span>
                {option.text}
            </span>
            {option.images && option.images.length > 0 && (
              <div className="option-images">
                 {option.images.map((imgSrc, idx) => (
                    <img key={idx} src={imgSrc} alt={`Option ${option.label} image ${idx + 1}`} className="option-image"/>
                 ))}
              </div>
            )}
            {/* Show percentage only if submitted (not just review mode unless desired) */}
            {isSubmitted && !isReviewMode && option.percentage_selected && (
                 <span className="option-percentage">{option.percentage_selected}</span>
            )}
          </label>
        ))}
      </div>

       <div className="action-buttons">
        {/* Show Submit only if NOT submitted AND NOT in review mode */}
        {!isSubmitted && !isReviewMode && (
          <button
             onClick={() => onSubmit(questionIndex)}
             className="submit-button"
             disabled={!selectedOption || crossedOffOptions.has(selectedOption)}
             title={crossedOffOptions.has(selectedOption) ? "Cannot submit a crossed-off option" : (!selectedOption ? "Please select an answer" : "")}
             >
            Submit Answer
          </button>
        )}
         {/* Show Explanation button if submitted OR in review mode */}
        {(isSubmitted || isReviewMode) && (
          <button onClick={() => onToggleExplanation(questionIndex)} className="explanation-button">
            {showExplanation ? 'Hide' : 'Show'} Explanation
          </button>
        )}
      </div>


      {/* Explanation Section: Show if explanation toggled OR in review mode */}
      {(showExplanation || isReviewMode) && explanation && ( // Check if explanation exists
        <div className="explanation-section">
          <h3 className="explanation-title">Explanation</h3>
          <div className="explanation-content">
            <p><strong>Correct Answer:</strong> {correct_answer_text}</p>
            {explanation.concept_text && <p>{explanation.concept_text}</p>}
            {explanation.poe_text && ( <div className="poe-section"> <h4>Process of Elimination:</h4> {renderPoeText(explanation.poe_text)} </div> )}
            {explanation.images && explanation.images.length > 0 && ( <div className="explanation-images"> {explanation.images.map((imgSrc, index) => ( <img key={index} src={imgSrc} alt={`Explanation image ${index + 1}`} /> ))} </div> )}
          </div>
           <div className="analytics-section">
                <h4>Analytics</h4>
                 <p>Time Spent: {
                    userTimeSpentOnQuestion !== undefined
                        ? `${userTimeSpentOnQuestion}s` // Display user's recorded time
                        : (analytics?.time_spent || 'N/A') // Fallback to JSON data
                 }</p>
                <p>Percent Correct (Average): {analytics.percent_correct || 'N/A'}</p>
                {(questionData.category || analytics?.category) && <p>Category: {questionData.category || analytics.category}</p>}
            </div>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;