// FILE: client/src/components/QuestionCard.jsx
import React from 'react';
import '../styles/QuestionCard.css';

// Helper to safely render POE text
const renderPoeText = (poeText) => {
    if (!poeText || typeof poeText !== 'string') {
        return <p>Process of elimination not available.</p>;
    }
    // Match "Option X." variants (optional space, case-insensitive)
    const parts = poeText.split(/(Option\s+[A-Z]\s*\.)/i);

    return parts.filter(part => part?.trim()).map((part, index) => {
        const isHeader = /Option\s+[A-Z]\s*\./i.test(part);
        if (isHeader) {
            // Render the header boldly
            return <strong key={`poe-header-${index}`} className="poe-header">{part.trim()}</strong>;
        } else {
             // Render the text part following a header, or the initial text
             // Check if the *previous* non-empty part was a header
             const previousPartIndex = parts.slice(0, index).findLastIndex(p => p?.trim());
             const previousPartIsHeader = previousPartIndex !== -1 && /Option\s+[A-Z]\s*\./i.test(parts[previousPartIndex]);

             if (index === 0 || previousPartIsHeader) {
                return <p key={`poe-text-${index}`} className="poe-text">{part.trim()}</p>;
             }
             // Avoid rendering text parts that might be empty strings or artifacts of splitting
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
  onOptionSelect,
  onSubmit,
  onToggleExplanation
}) {

  // Handle cases where question data might be missing or is an error object
   if (!questionData || typeof questionData !== 'object' || questionData === null) {
     console.warn(`[QuestionCard] Invalid question data at index ${questionIndex}:`, questionData);
     return (
       <div className="question-card error-card">
         <p className="error-message">
           Error displaying Question {questionIndex + 1}: Invalid data format.
         </p>
       </div>
     );
   }

  // Handle specific error objects passed down
  if (questionData.error) {
    return (
      <div className="question-card error-card">
        <p className="error-message">
          Error loading Question {questionIndex + 1}:
          <br />
          <span className="error-details">{questionData.error}</span>
        </p>
      </div>
    );
  }

  // Destructure safely, providing defaults
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

  const getOptionClassName = (option) => {
    let className = 'option-label';
    if (isSubmitted) {
      if (option.is_correct) {
        className += ' correct';
      } else if (option.label === selectedOption) {
        className += ' incorrect';
      }
    } else if (option.label === selectedOption) {
      className += ' selected';
    }
    // Add disabled class if submitted
    if (isSubmitted) {
        className += ' submitted';
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
        {/* Ensure options is an array before mapping */}
        {Array.isArray(options) && options.map((option) => (
          <label key={option.label} className={getOptionClassName(option)}>
            <input
              type="radio"
              name={`question-${questionIndex}`}
              value={option.label}
              checked={selectedOption === option.label}
              onChange={() => handleSelect(option.label)}
              disabled={isSubmitted}
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

       {/* Action Buttons (Submit / Show Explanation) */}
       <div className="action-buttons">
        {!isSubmitted ? (
          <button onClick={() => onSubmit(questionIndex)} className="submit-button" disabled={!selectedOption}>
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

            {/* Concept Text */}
            {explanation.concept_text && <p>{explanation.concept_text}</p>}

             {/* POE Text */}
            {explanation.poe_text && (
                <div className="poe-section">
                    <h4>Process of Elimination:</h4>
                    {renderPoeText(explanation.poe_text)}
                </div>
            )}

            {/* Explanation Images */}
            {explanation.images && explanation.images.length > 0 && (
              <div className="explanation-images">
                {explanation.images.map((imgSrc, index) => (
                  <img key={index} src={imgSrc} alt={`Explanation image ${index + 1}`} />
                ))}
              </div>
            )}
          </div>

           {/* Analytics Section */}
            <div className="analytics-section">
                <h4>Analytics</h4>
                <p>Percent Correct: {analytics.percent_correct}</p>
                <p>Avg Time Spent: {analytics.time_spent}</p>
                 {/* Display category from question data if available */}
                {(questionData.category || analytics?.category) &&
                    <p>Category: {questionData.category || analytics.category}</p>
                }
            </div>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;