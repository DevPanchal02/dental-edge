// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuizData, getQuizMetadata } from '../data/loader'; // Use dynamic loader
import QuestionCard from '../components/QuestionCard';
import '../styles/QuizPage.css';

function QuizPage() {
  const { topicId, sectionType, quizId } = useParams();
  const navigate = useNavigate();

  const [quizData, setQuizData] = useState(null);
  const [quizMetadata, setQuizMetadata] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { questionIndex: selectedOptionLabel }
  const [submittedAnswers, setSubmittedAnswers] = useState({}); // { questionIndex: true }
  const [showExplanation, setShowExplanation] = useState({}); // { questionIndex: true/false }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize data loading function
  const loadQuiz = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      // Use functions from the dynamic loader
      const data = getQuizData(topicId, sectionType, quizId);
      const metadata = getQuizMetadata(topicId, sectionType, quizId);

      if (!data || !metadata) {
        throw new Error(`Quiz data not found for ${topicId}/${sectionType}/${quizId}. Check data/loader.js and file structure.`);
      }

      // Filter out potential null/error entries if needed, or handle in QuestionCard
      // The loader now includes the data directly
      setQuizData(Array.isArray(data) ? data : []); // Ensure quizData is an array
      setQuizMetadata(metadata);
      // Reset state for new quiz
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setSubmittedAnswers({});
      setShowExplanation({});

    } catch (err) {
      console.error('Error loading quiz:', err);
      setError(err.message || 'Failed to load quiz.');
      setQuizData(null);
      setQuizMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }, [topicId, sectionType, quizId]); // Dependencies for useCallback

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]); // useEffect dependency array includes the memoized function

  const handleOptionSelect = (questionIndex, optionLabel) => {
    // Allow changing answer only if not submitted
    if (!submittedAnswers[questionIndex]) {
      setUserAnswers((prev) => ({
        ...prev,
        [questionIndex]: optionLabel,
      }));
    }
  };

  const handleSubmitAnswer = (questionIndex) => {
    if (userAnswers[questionIndex]) { // Only submit if an answer is selected
        setSubmittedAnswers((prev) => ({
            ...prev,
            [questionIndex]: true,
        }));
        // Optionally auto-show explanation on submit
        setShowExplanation((prev) => ({
            ...prev,
            [questionIndex]: true,
        }));
    } else {
        // Maybe show a message to select an answer first
        alert("Please select an answer before submitting.");
    }
  };

  const toggleExplanation = (questionIndex) => {
    setShowExplanation((prev) => ({
      ...prev,
      [questionIndex]: !prev[questionIndex],
    }));
  };

  const handleNext = () => {
    if (quizData && currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleFinishQuiz = () => {
    // Optional: Show summary/results page
    alert("Quiz Finished! (Implement results page later)");
    navigate(`/topic/${topicId}`); // Go back to topic page
  };

  // --- Render Logic ---

  if (isLoading) {
    return <div className="page-loading">Loading Quiz...</div>;
  }

  if (error) {
    return (
      <div className="page-error">
        Error: {error}
        <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button">
          Back to Topic
        </button>
      </div>
    );
  }

  if (!quizData || quizData.length === 0) {
    return (
      <div className="page-info">
        No valid questions found for this quiz. Check the JSON file format.
        <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button">
          Back to Topic
        </button>
      </div>
    );
  }

  const currentQuestionData = quizData[currentQuestionIndex];
  const isSubmitted = !!submittedAnswers[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizData.length - 1;

  return (
    <div className="quiz-page-container">
      <div className="quiz-header">
        <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button-quiz">
          ← Back to {topicId.charAt(0).toUpperCase() + topicId.slice(1).replace(/-/g, ' ')}
        </button>
        <h1 className="quiz-title">{quizMetadata?.name || 'Quiz'}</h1>
        <p className="quiz-progress">
          Question {currentQuestionIndex + 1} of {quizData.length}
        </p>
      </div>

      <QuestionCard
        questionData={currentQuestionData}
        questionIndex={currentQuestionIndex}
        selectedOption={userAnswers[currentQuestionIndex]}
        isSubmitted={isSubmitted}
        showExplanation={showExplanation[currentQuestionIndex]}
        onOptionSelect={handleOptionSelect}
        onSubmit={handleSubmitAnswer}
        onToggleExplanation={toggleExplanation}
      />

      <div className="quiz-navigation">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="nav-button prev-button"
        >
          Previous
        </button>
        {isLastQuestion && isSubmitted ? (
           <button onClick={handleFinishQuiz} className="nav-button finish-button">
             Finish Quiz
           </button>
        ) : (
           <button
             onClick={handleNext}
             // Only disable if it's the last question, allow moving even if not submitted
             disabled={currentQuestionIndex === quizData.length - 1}
             className="nav-button next-button"
           >
             Next
           </button>
        )}
      </div>
    </div>
  );
}

export default QuizPage;