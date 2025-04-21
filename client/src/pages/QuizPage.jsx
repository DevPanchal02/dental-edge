// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { useParams, useNavigate } from 'react-router-dom';
import { getQuizData, getQuizMetadata } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import '../styles/QuizPage.css';

// --- Timer Configuration ---
const PRACTICE_TEST_DURATIONS = { // Durations in seconds
    biology: 20 * 60,
    chemistry: 30 * 60,
    'perceptual-ability': 60 * 60,
    'reading-comphrension': 60 * 60,
    default: 30 * 60 // Default fallback if topic not listed
};

// Helper function to format time (MM:SS)
const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0; // Ensure non-negative
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
// --- End Timer Configuration ---

function QuizPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();
    const timerIntervalRef = useRef(null); // Ref to store interval ID

    const [quizData, setQuizData] = useState(null);
    const [quizMetadata, setQuizMetadata] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [submittedAnswers, setSubmittedAnswers] = useState({});
    const [showExplanation, setShowExplanation] = useState({});
    const [crossedOffOptions, setCrossedOffOptions] = useState({}); // { qIndex: Set<optionLabel> }
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Timer State
    const [timerValue, setTimerValue] = useState(0); // Initial value (seconds)
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [initialDuration, setInitialDuration] = useState(0); // For countdown display

    // --- Data Loading ---
    const loadQuiz = useCallback(() => {
        setIsLoading(true);
        setError(null);
        // Reset all quiz-specific state
        setQuizData(null);
        setQuizMetadata(null);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setSubmittedAnswers({});
        setShowExplanation({});
        setCrossedOffOptions({});
        setIsTimerActive(false); // Stop timer during load
        setTimerValue(0);
        setIsCountdown(false);
        if (timerIntervalRef.current) {
             clearInterval(timerIntervalRef.current); // Clear existing interval
             timerIntervalRef.current = null;
        }


        try {
            const data = getQuizData(topicId, sectionType, quizId);
            const metadata = getQuizMetadata(topicId, sectionType, quizId);

            if (!data || data.length === 0 || !metadata) {
                throw new Error(`Quiz data or metadata not found for ${topicId}/${sectionType}/${quizId}.`);
            }

            setQuizData(data);
            setQuizMetadata(metadata);

            // --- Initialize Timer ---
            if (sectionType === 'practice') {
                const duration = PRACTICE_TEST_DURATIONS[topicId] || PRACTICE_TEST_DURATIONS.default;
                console.log(`[QuizPage] Setting up countdown for ${topicId}. Duration: ${duration}s`);
                setTimerValue(duration);
                setInitialDuration(duration); // Store initial duration
                setIsCountdown(true);
                setIsTimerActive(true); // Start timer for practice tests
            } else if (sectionType === 'qbank') {
                 console.log(`[QuizPage] Setting up count-up timer for QBank.`);
                setTimerValue(0);
                setIsCountdown(false);
                setIsTimerActive(true); // Start timer for question banks
            }
            // --- End Timer Initialization ---

        } catch (err) {
            console.error('[QuizPage] Error loading quiz:', err);
            setError(err.message || 'Failed to load quiz.');
            setQuizData(null);
            setQuizMetadata(null);
        } finally {
            setIsLoading(false);
        }
    }, [topicId, sectionType, quizId]); // Dependencies for useCallback

    useEffect(() => {
        loadQuiz();
        // Cleanup timer on component unmount
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [loadQuiz]); // Run loadQuiz when dependencies change

    // --- Timer Effect ---
    useEffect(() => {
        if (isTimerActive) {
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current); // Stop timer
                            timerIntervalRef.current = null;
                            setIsTimerActive(false);
                            // Optional: Auto-finish or show time's up message
                            alert("Time's up!");
                            // handleFinishQuiz(); // Optionally auto-finish
                            return 0;
                        }
                        return newTime;
                    } else {
                        // Count up
                        return prevTime + 1;
                    }
                });
            }, 1000); // Update every second
        } else {
             // Clear interval if timer becomes inactive
             if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        }

        // Cleanup function for when isTimerActive or isCountdown changes, or component unmounts
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [isTimerActive, isCountdown]); // Rerun effect if these change

    // --- Event Handlers ---
    const handleOptionSelect = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex]) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    };

    const handleSubmitAnswer = (questionIndex) => {
        if (userAnswers[questionIndex]) {
            setSubmittedAnswers((prev) => ({ ...prev, [questionIndex]: true }));
            setShowExplanation((prev) => ({ ...prev, [questionIndex]: true }));
        } else {
            alert("Please select an answer before submitting.");
        }
    };

    const toggleExplanation = (questionIndex) => {
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    };

    // Handler for right-click cross-off
    const handleToggleCrossOff = (questionIndex, optionLabel) => {
        setCrossedOffOptions(prev => {
            const currentSet = prev[questionIndex] ? new Set(prev[questionIndex]) : new Set();
            if (currentSet.has(optionLabel)) {
                currentSet.delete(optionLabel);
            } else {
                currentSet.add(optionLabel);
            }
            return { ...prev, [questionIndex]: currentSet };
        });
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
        setIsTimerActive(false); // Stop timer on finish
        // Optional: Show summary/results page
        alert("Quiz Finished! (Implement results page later)");
        navigate(`/topic/${topicId}`); // Go back to topic page
    };

    // --- Render Logic ---

    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return (
        <div className="page-error"> Error: {error}
            <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );
    if (!quizData || quizData.length === 0) return (
        <div className="page-info"> No valid questions found for this quiz.
             <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );

    const currentQuestionData = quizData[currentQuestionIndex];
    const isSubmitted = !!submittedAnswers[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    const currentCrossedOff = crossedOffOptions[currentQuestionIndex] || new Set();

    return (
        <div className="quiz-page-container">
            {/* Header without timer */}
            <div className="quiz-header">
                <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button-quiz">
                    ← Back to {topicId.charAt(0).toUpperCase() + topicId.slice(1).replace(/-/g, ' ')}
                </button>
                <h1 className="quiz-title">{quizMetadata?.name || 'Quiz'}</h1>
                <p className="quiz-progress">
                    Question {currentQuestionIndex + 1} of {quizData.length}
                </p>
            </div>

            {/* Wrapper for Timer and Question Card */}
            <div className="quiz-content-area">
                {/* Timer Display - Moved Here */}
                <div className="timer-display">
                    {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
                    <span className={isCountdown && timerValue < 60 ? 'timer-low' : ''}>
                        {formatTime(timerValue)}
                    </span>
                    {isCountdown && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
                </div>
                {/* End Timer Display */}

                <QuestionCard
                    questionData={currentQuestionData}
                    questionIndex={currentQuestionIndex}
                    selectedOption={userAnswers[currentQuestionIndex]}
                    isSubmitted={isSubmitted}
                    showExplanation={showExplanation[currentQuestionIndex]}
                    crossedOffOptions={currentCrossedOff} // Pass down crossed off set
                    onOptionSelect={handleOptionSelect}
                    onSubmit={handleSubmitAnswer}
                    onToggleExplanation={toggleExplanation}
                    onToggleCrossOff={handleToggleCrossOff} // Pass down toggle handler
                />
            </div> {/* End quiz-content-area */}


            {/* Navigation remains the same */}
            <div className="quiz-navigation">
                 <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="nav-button prev-button"
                > Previous </button>
                {isLastQuestion && isSubmitted ? (
                    <button onClick={handleFinishQuiz} className="nav-button finish-button"> Finish Quiz </button>
                ) : (
                    <button
                        onClick={handleNext}
                        disabled={currentQuestionIndex === quizData.length - 1}
                        className="nav-button next-button"
                    > Next </button>
                )}
            </div>
        </div>
    );
}

export default QuizPage;