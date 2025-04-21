// FILE: client/src/components/QuestionCard.jsx
import React from 'react';
import '../styles/QuestionCard.css';

// Helper to safely render POE text (same as before)
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
  isSubmitted,
  showExplanation,
  crossedOffOptions, // Receive crossed off options Set
  onOptionSelect,
  onSubmit,
  onToggleExplanation,
  onToggleCrossOff // Receive handler for right-click
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
    if (!isSubmitted) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  // Handle Right Click
  const handleContextMenu = (event, optionLabel) => {
      event.preventDefault(); // Prevent default browser menu
      if (!isSubmitted) { // Only allow crossing off before submitting
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { // Check if crossed off
        className += ' crossed-off';
    }
    if (isSubmitted) {
        className += ' submitted'; // General submitted state
        if (option.is_correct) {
            className += ' correct';
        } else if (option.label === selectedOption) {
            className += ' incorrect';
        }
    } else if (option.label === selectedOption) {
        className += ' selected';
    }
    return className;
  };

  return (
    <div className="question-card">
      {/* Question Text and Images */}
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

      {/* Options */}
      <div className="options-container">
        {Array.isArray(options) && options.map((option) => (
          <label
            key={option.label}
            className={getOptionClassName(option)}
            onContextMenu={(e) => handleContextMenu(e, option.label)} // Add context menu handler
          >
            <input
              type="radio"
              name={`question-${questionIndex}`}
              value={option.label}
              checked={selectedOption === option.label && !crossedOffOptions.has(option.label)} // Don't show radio checked if crossed off
              onChange={() => handleSelect(option.label)}
              disabled={isSubmitted || crossedOffOptions.has(option.label)} // Disable radio if submitted or crossed off
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
            {isSubmitted && option.percentage_selected && (
                 <span className="option-percentage">{option.percentage_selected}</span>
            )}
          </label>
        ))}
      </div>

       {/* Action Buttons */}
       <div className="action-buttons">
        {!isSubmitted ? (
          <button
             onClick={() => onSubmit(questionIndex)}
             className="submit-button"
             disabled={!selectedOption || crossedOffOptions.has(selectedOption)} // Disable submit if selected option is crossed off
             title={crossedOffOptions.has(selectedOption) ? "Cannot submit a crossed-off option" : ""}
             >
            Submit Answer
          </button>
        ) : (
          <button onClick={() => onToggleExplanation(questionIndex)} className="explanation-button">
            {showExplanation ? 'Hide' : 'Show'} Explanation
          </button>
        )}
      </div>


      {/* Explanation Section */}
      {isSubmitted && showExplanation && (
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
                <p>Percent Correct: {analytics.percent_correct}</p>
                <p>Avg Time Spent: {analytics.time_spent}</p>
                {(questionData.category || analytics?.category) && <p>Category: {questionData.category || analytics.category}</p>}
            </div>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;