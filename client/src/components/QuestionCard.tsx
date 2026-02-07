import React from 'react';
import '../styles/QuestionCard.css';
import { Question, Option } from '../types/quiz.types';
import SafeHtml from './SafeHtml';

interface QuestionCardProps {
    questionData: Question | null;
    questionIndex: number;
    // Explicitly handle nullable selection (user hasn't answered yet)
    selectedOption: string | null | undefined; 
    isSubmitted: boolean;
    showExplanation: boolean;
    
    // Performance: Set allows O(1) lookup complexity.
    crossedOffOptions: Set<string>;
    
    userTimeSpentOnQuestion?: number;
    isReviewMode: boolean;
    
    // Strict callback signatures ensure we pass exactly the data the parent expects
    onOptionSelect: (index: number, label: string) => void;
    onToggleExplanation: (index: number) => void;
    onToggleCrossOff: (index: number, label: string) => void;
    onToggleMark: (index: number) => void;
    
    isTemporarilyRevealed: boolean;
    isPracticeTestActive: boolean;
    highlightedHtml?: Record<string, string>;
}

function QuestionCard({
  questionData,
  questionIndex,
  selectedOption,
  isSubmitted,
  showExplanation,
  crossedOffOptions,
  userTimeSpentOnQuestion,
  isReviewMode,
  onOptionSelect,
  onToggleExplanation,
  onToggleCrossOff,
  isTemporarilyRevealed,
  isPracticeTestActive,
  highlightedHtml,
}: QuestionCardProps) {

   // Guard Clause: Fail gracefully if data is malformed or missing.
   if (!questionData || typeof questionData !== 'object') {
     return ( <div className="question-card error-card"><p className="error-message">Error displaying Question {questionIndex + 1}: Invalid data format.</p></div> );
   }
   if (questionData.error) {
    return ( <div className="question-card error-card"><p className="error-message">Error loading Question {questionIndex + 1}:<br /><span className="error-details">{questionData.error}</span></p></div> );
  }

  // Destructure with default values to ensure UI stability even if fields are missing
  const {
      question = { html_content: '<p>Question content missing.</p>' },
      options = [],
      correct_answer_original_text = 'N/A',
      explanation = { html_content: '<p>Explanation not available.</p>' },
      analytics = { percent_correct: 'N/A', time_spent: 'N/A' }
  } = questionData;

  // Helper: Check if there is a highlighted version of the text in the user's attempt state.
  const getDisplayHtml = (originalHtml: string, contentKey: string) => {
    return highlightedHtml && highlightedHtml[contentKey] !== undefined
      ? highlightedHtml[contentKey]
      : originalHtml;
  };

  const handleSelect = (e: React.MouseEvent, optionLabel: string) => {
    if (e && e.preventDefault) e.preventDefault();

    // Logic: Block selection if the quiz is in "Read Only" mode (Review/Submitted)
    const trulySubmitted = isPracticeTestActive ? false : (isSubmitted && !isReviewMode && !isTemporarilyRevealed);

    if (!trulySubmitted && !isReviewMode && !isTemporarilyRevealed && !crossedOffOptions.has(optionLabel)) {
      onOptionSelect(questionIndex, optionLabel);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, optionLabel: string) => {
      event.preventDefault(); // Prevent native browser context menu
      const trulySubmittedForCrossOff = isPracticeTestActive ? false : (isSubmitted && !isReviewMode && !isTemporarilyRevealed);
      
      // Allow crossing off only if the question isn't finalized
      if (!trulySubmittedForCrossOff && !isReviewMode && !isTemporarilyRevealed) {
        onToggleCrossOff(questionIndex, optionLabel);
      }
  };

  // Logic to determine visual state (Correct/Incorrect/Selected/Crossed)
  const getOptionClassName = (option: Option) => {
    let className = 'option-label';
    if (crossedOffOptions.has(option.label)) { className += ' crossed-off'; }

    const isThisOptionSelected = option.label === selectedOption && !crossedOffOptions.has(option.label);
    
    // If we are showing results (Review/Submitted/Revealed), we apply grading styles
    const showGradingStyles = isReviewMode || isTemporarilyRevealed || (!isPracticeTestActive && isSubmitted);

    if (showGradingStyles) {
        className += ' submitted'; 
        if (option.is_correct) {
            className += ' correct';
        } else if (isThisOptionSelected) { 
            className += ' incorrect';
        }
    } else {
        // Standard interactive state
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
            {/* Render Question Text with potential Highlights */}
            <SafeHtml
              className="question-html-content"
              html={getDisplayHtml(question.html_content, `question_${questionIndex}`)}
              data-content-key={`question_${questionIndex}`}
            />
          </div>

          <div className="options-container">
            {Array.isArray(options) && options.map((option) => (
              <label
                key={option.label}
                className={getOptionClassName(option)}
                onContextMenu={(e) => handleContextMenu(e, option.label)}
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
                    <SafeHtml
                      className="option-html-content"
                      html={getDisplayHtml(option.html_content, `option_${questionIndex}_${option.label}`)}
                      data-content-key={`option_${questionIndex}_${option.label}`}
                    />
                </span>
                {/* Show peer analytics statistics if available and in review mode */}
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
                <SafeHtml
                  className="explanation-html-content"
                  html={getDisplayHtml(explanation.html_content, `explanation_${questionIndex}`)}
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