// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import '../styles/QuizPage.css';

// --- Timer Configuration ---
const PRACTICE_TEST_DURATIONS = {
    biology: 20 * 60, chemistry: 30 * 60,
    'perceptual-ability': 60 * 60, 'reading-comphrension': 60 * 60,
    default: 30 * 60
};

const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
// --- End Timer Configuration ---

function QuizPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const timerIntervalRef = useRef(null);
    const questionStartTimeRef = useRef(null);
    const isReviewMode = location.state?.review || false;
    const reviewQuestionIndex = location.state?.questionIndex;

    // State variables
    const [allQuizQuestions, setAllQuizQuestions] = useState([]);
    const [displayableQuizData, setDisplayableQuizData] = useState([]);
    const [quizMetadata, setQuizMetadata] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [submittedAnswers, setSubmittedAnswers] = useState({});
    const [showExplanation, setShowExplanation] = useState({});
    const [crossedOffOptions, setCrossedOffOptions] = useState({}); // Store Sets here
    const [userTimeSpent, setUserTimeSpent] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerValue, setTimerValue] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [initialDuration, setInitialDuration] = useState(0);
    const isMountedRef = useRef(true); // Ref to track mount status

    // --- localStorage Key ---
    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    // --- Save State to localStorage ---
    // Use useRef to store latest state for saving without adding state to useCallback deps
    const stateRef = useRef();
    stateRef.current = {
        currentQuestionIndex, userAnswers, submittedAnswers, crossedOffOptions,
        userTimeSpent, timerValue, isCountdown, initialDuration
    };

    const saveState = useCallback(() => {
        if (isReviewMode || !isMountedRef.current) return; // Don't save in review or if unmounted

        const stateToSave = {
            ...stateRef.current, // Get latest state from ref
             // Convert crossedOffOptions Set values to Arrays for storage
            crossedOffOptions: Object.fromEntries(
                Object.entries(stateRef.current.crossedOffOptions).map(([key, valueSet]) => [
                    key,
                    Array.from(valueSet instanceof Set ? valueSet : new Set()) // Ensure it's a Set before converting
                ])
            ),
        };
        try {
            localStorage.setItem(getQuizStateKey(), JSON.stringify(stateToSave));
            // console.log("[QuizPage] State Saved:", stateToSave);
        } catch (e) {
            console.error("[QuizPage] Error saving state to localStorage:", e);
        }
    }, [getQuizStateKey, isReviewMode]); // Depends only on key and review mode


    // --- Load State from localStorage ---
    // This runs ONLY ONCE during the initial load process
    const loadSavedStateAndInitialize = useCallback((data, metadata) => {
        let stateLoaded = false;
        let loadedState = null;

        if (isReviewMode) {
            console.log("[QuizPage] Review mode: Loading results state.");
            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResults = localStorage.getItem(resultsKey);
            if (savedResults) {
                try {
                    const parsedResults = JSON.parse(savedResults);
                    setUserAnswers(parsedResults.userAnswers || {});
                    const allSubmitted = {};
                    data.forEach((q, index) => { if (q && !q.error) allSubmitted[index] = true; });
                    setSubmittedAnswers(allSubmitted);
                    const jumpToIndex = reviewQuestionIndex ?? 0;
                    setCurrentQuestionIndex(jumpToIndex);
                    setShowExplanation({ [jumpToIndex]: true });
                    // Load crossed off if saved in results (optional)
                    // const loadedCrossed = {};
                    // for (const qIdx in parsedResults.crossedOffOptions) {
                    //     loadedCrossed[qIdx] = new Set(parsedResults.crossedOffOptions[qIdx]);
                    // }
                    // setCrossedOffOptions(loadedCrossed);
                    stateLoaded = true; // Indicate review state processed
                } catch (e) { console.error("Error parsing results for review:", e); }
            } else {
                console.warn("No results found to populate review mode state.");
                // Fallback for review mode without results data
                const allSubmitted = {};
                data.filter(q => q && !q.error).forEach((_, index) => { allSubmitted[index] = true; });
                setSubmittedAnswers(allSubmitted);
                const jumpToIndex = reviewQuestionIndex ?? 0;
                setCurrentQuestionIndex(jumpToIndex);
                setShowExplanation({ [jumpToIndex]: true });
                stateLoaded = true;
            }
             // Ensure timer is off in review
            setIsTimerActive(false);
            setTimerValue(0);
            setIsCountdown(false);

        } else {
            // Try loading in-progress state if NOT in review mode
            const savedStateString = localStorage.getItem(getQuizStateKey());
            if (savedStateString) {
                try {
                    loadedState = JSON.parse(savedStateString);
                    console.log("[QuizPage] Loading In-Progress State:", loadedState);
                    setCurrentQuestionIndex(loadedState.currentQuestionIndex || 0);
                    setUserAnswers(loadedState.userAnswers || {});
                    setSubmittedAnswers(loadedState.submittedAnswers || {});
                    const loadedCrossed = {};
                    for (const qIndex in loadedState.crossedOffOptions) {
                        if (Array.isArray(loadedState.crossedOffOptions[qIndex])) {
                            loadedCrossed[qIndex] = new Set(loadedState.crossedOffOptions[qIndex]);
                        }
                    }
                    setCrossedOffOptions(loadedCrossed || {});
                    setUserTimeSpent(loadedState.userTimeSpent || {});
                    setTimerValue(loadedState.timerValue !== undefined ? loadedState.timerValue : 0);
                    setIsCountdown(loadedState.isCountdown !== undefined ? loadedState.isCountdown : false);
                    setInitialDuration(loadedState.initialDuration || 0);
                    // Resume timer ONLY if it hasn't reached 0 in countdown mode
                    if (!(loadedState.isCountdown && loadedState.timerValue <= 0)) {
                        setIsTimerActive(true);
                    } else {
                         setIsTimerActive(false); // Keep timer stopped if it already finished
                    }
                    stateLoaded = true;
                } catch (e) {
                    console.error("[QuizPage] Error loading saved state:", e);
                    localStorage.removeItem(getQuizStateKey());
                }
            }
        }

        // Initialize if no state was loaded and not in review mode
        if (!stateLoaded && !isReviewMode) {
            console.log("[QuizPage] No saved state found or review mode, initializing quiz.");
            setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
            setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});

            if (sectionType === 'practice') {
                const duration = PRACTICE_TEST_DURATIONS[topicId] || PRACTICE_TEST_DURATIONS.default;
                setTimerValue(duration); setInitialDuration(duration);
                setIsCountdown(true); setIsTimerActive(true);
            } else if (sectionType === 'qbank') {
                setTimerValue(0); setIsCountdown(false); setIsTimerActive(true);
            }
        }

    }, [getQuizStateKey, isReviewMode, reviewQuestionIndex, topicId, sectionType, quizId]); // Dependencies for loading logic

    // --- Data Loading Effect ---
    useEffect(() => {
        isMountedRef.current = true; // Set mount status
        setIsLoading(true);
        setError(null);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        try {
            const data = getQuizData(topicId, sectionType, quizId);
            const metadata = getQuizMetadata(topicId, sectionType, quizId);

            if (!data || !metadata) throw new Error(`Quiz data/metadata not found.`);

            setAllQuizQuestions(data);
            const filteredData = data.filter(q => q && !q.error);
            if (filteredData.length === 0 && data.length > 0) {
                // Don't throw error here, allow rendering with error message
                console.warn("No valid questions found in the data file.");
            }
            setDisplayableQuizData(filteredData);
            setQuizMetadata(metadata);

            // Load state or initialize AFTER setting data
            loadSavedStateAndInitialize(data, metadata);

        } catch (err) {
            console.error('[QuizPage] Error loading quiz data:', err);
            setError(err.message || 'Failed to load quiz.');
            setAllQuizQuestions([]); setDisplayableQuizData([]); setQuizMetadata(null);
        } finally {
            if(isMountedRef.current) setIsLoading(false);
        }

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false; // Set unmounted status
            saveState(); // Save state one last time on unmount
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, loadSavedStateAndInitialize]); // Depend on loader params and the loader function


    // --- Timer Effect ---
    useEffect(() => {
        if (isTimerActive && !isReviewMode) { // Don't run timer in review mode
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current);
                            timerIntervalRef.current = null;
                            setIsTimerActive(false); // Stop internal state
                            alert("Time's up!");
                            handleFinishQuiz(true); // Finish quiz, indicate timeout
                            return 0;
                        }
                        return newTime;
                    } else {
                        return prevTime + 1; // Count up
                    }
                });
            }, 1000);
        } else {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        }
        // Cleanup interval when effect re-runs or component unmounts
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTimerActive, isCountdown, isReviewMode]); // Rerun effect if these change
    // Note: handleFinishQuiz removed from deps to prevent issues

    // --- Effect to Record Question Start Time ---
     useEffect(() => {
        if (!isLoading && displayableQuizData?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode) {
            if (!submittedAnswers[currentQuestionIndex]) {
                // console.log(`[QuizPage] Recording start time for Question ${currentQuestionIndex + 1}`);
                questionStartTimeRef.current = Date.now();
            } else {
                questionStartTimeRef.current = null;
            }
        }
    }, [currentQuestionIndex, isLoading, displayableQuizData, submittedAnswers, isReviewMode]);


    // --- Event Handlers ---
    const handleOptionSelect = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
            // Saving happens via stateRef in saveState called by other actions
        }
    };

    const handleSubmitAnswer = (questionIndex) => {
        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex] && !isReviewMode) {
            let elapsedSeconds = -1;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                const elapsedMs = endTime - questionStartTimeRef.current;
                elapsedSeconds = Math.round(elapsedMs / 1000);
                questionStartTimeRef.current = null;
            } else { console.warn(`[QuizPage] Could not record time for Q${questionIndex + 1}`); }

            // Use functional updates for reliability
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));

            // Save state explicitly after submission
            saveState();
        } else if (!userAnswers[questionIndex] && !isReviewMode) {
            alert("Please select an answer before submitting.");
        }
    };

    const toggleExplanation = (questionIndex) => {
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
        // No need to save state for this visual toggle
    };

    const handleToggleCrossOff = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode) {
            let newCrossedOffState; // To store the state before saving
            setCrossedOffOptions(prev => {
                const currentSet = prev[questionIndex] ? new Set(prev[questionIndex]) : new Set();
                if (currentSet.has(optionLabel)) {
                    currentSet.delete(optionLabel);
                } else {
                    currentSet.add(optionLabel);
                }
                // Deselect if crossed off
                if (currentSet.has(userAnswers[questionIndex])) {
                    setUserAnswers(prevUserAnswers => {
                        const updatedAnswers = { ...prevUserAnswers };
                        delete updatedAnswers[questionIndex];
                        return updatedAnswers;
                    });
                }
                newCrossedOffState = { ...prev, [questionIndex]: currentSet }; // Store Set for component
                return newCrossedOffState;
            });
            // Save state explicitly after cross-off change
             saveState();
        }
    };

    const handleNext = () => {
        if (displayableQuizData && currentQuestionIndex < displayableQuizData.length - 1) {
            saveState(); // Save before navigating
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
             saveState(); // Save before navigating
             questionStartTimeRef.current = null;
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    // --- Finish Quiz Logic ---
    const handleFinishQuiz = (timedOut = false) => {
        if (isReviewMode) {
             navigate(`/results/${topicId}/${sectionType}/${quizId}`);
             return;
        }

        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        console.log("[QuizPage] Finishing Quiz. Calculating results...");
        // Ensure we use the most up-to-date state from the ref for calculations
        const finalState = stateRef.current;

        let score = 0;
        let correctIndices = [];
        let incorrectIndices = [];
        const totalPossibleScore = allQuizQuestions.length; // Total including errors
        const totalValidQuestions = displayableQuizData.length; // Total excluding errors

        allQuizQuestions.forEach((q, index) => {
            if (!q || q.error) return; // Skip error questions

            const userAnswerLabel = finalState.userAnswers[index];
            const isCorrect = q.options?.find(opt => opt.label === userAnswerLabel)?.is_correct ?? false;

            // Check submission status from the final state
            if (finalState.submittedAnswers[index] && isCorrect) {
                score++;
                correctIndices.push(index);
            } else if (finalState.submittedAnswers[index]) { // Submitted but wrong
                incorrectIndices.push(index);
            } else { // Not submitted
                if (timedOut || sectionType === 'practice') {
                   incorrectIndices.push(index);
                }
            }
        });

        const results = {
            score,
            totalQuestions: totalPossibleScore,
            totalValidQuestions: totalValidQuestions,
            correctIndices,
            incorrectIndices,
            userAnswers: finalState.userAnswers, // Save final answers
            userTimeSpent: finalState.userTimeSpent, // Save final times
            timestamp: Date.now(),
            quizName: quizMetadata?.name || 'Quiz',
            topicName: topicId
        };

        console.log("[QuizPage] Calculated Results:", results);
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        try {
            localStorage.setItem(resultsKey, JSON.stringify(results));
            console.log(`[QuizPage] Results saved to localStorage.`);
        } catch (e) { console.error("Error saving results:", e); }

        localStorage.removeItem(getQuizStateKey());
        console.log(`[QuizPage] Removed in-progress state.`);
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    };

    // --- Render Logic ---

    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    if (!displayableQuizData || displayableQuizData.length === 0) return ( <div className="page-info"> No valid questions found for this quiz. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );

    const currentQuestionData = displayableQuizData[currentQuestionIndex];
    const currentIsSubmitted = !!submittedAnswers[currentQuestionIndex] || isReviewMode;
    const isLastQuestion = currentQuestionIndex === displayableQuizData.length - 1;
    const currentCrossedOff = crossedOffOptions[currentQuestionIndex] || new Set();

     if (!currentQuestionData) {
         console.error(`Error: No question data found at index ${currentQuestionIndex}`);
         return <div className="page-error">Error displaying question. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
     }

    return (
        <div className="quiz-page-container">
            <div className="quiz-header">
                <button onClick={() => isReviewMode ? navigate(`/results/${topicId}/${sectionType}/${quizId}`) : navigate(`/topic/${topicId}`)} className="back-button-quiz">
                    {isReviewMode ? `\u21A9 Back to Results` : `\u21A9 Back to ${formatDisplayName(topicId)}`}
                </button>
                <h1 className="quiz-title">{quizMetadata?.name || 'Quiz'}</h1>
                <p className="quiz-progress">
                    Question {currentQuestionIndex + 1} of {displayableQuizData.length}
                </p>
            </div>

            <div className="quiz-content-area">
                {!isReviewMode && (
                    <div className="timer-display">
                        {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
                        <span className={isCountdown && timerValue < 60 ? 'timer-low' : ''}>
                            {formatTime(timerValue)}
                        </span>
                        {isCountdown && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
                    </div>
                )}

                <QuestionCard
                    questionData={currentQuestionData}
                    questionIndex={currentQuestionIndex}
                    selectedOption={userAnswers[currentQuestionIndex]}
                    isSubmitted={currentIsSubmitted}
                    showExplanation={showExplanation[currentQuestionIndex] || (isReviewMode && !!currentQuestionData?.explanation)}
                    crossedOffOptions={currentCrossedOff}
                    userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]}
                    isReviewMode={isReviewMode}
                    onOptionSelect={handleOptionSelect}
                    onSubmit={handleSubmitAnswer}
                    onToggleExplanation={toggleExplanation}
                    onToggleCrossOff={handleToggleCrossOff}
                />
            </div>

            <div className="quiz-navigation">
                 <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="nav-button prev-button"
                > Previous </button>
                {/* Show Finish button on last question OR always in review mode */}
                {(isLastQuestion || isReviewMode) ? (
                    <button onClick={() => handleFinishQuiz(false)} className="nav-button finish-button">
                        {isReviewMode ? 'Back to Results' : 'Finish Quiz'}
                    </button>
                ) : (
                    <button
                        onClick={handleNext}
                        className="nav-button next-button"
                    > Next </button>
                )}
            </div>
        </div>
    );
}

export default QuizPage;