// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import ReviewModal from '../components/ReviewModal';
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
    const location = useLocation();
    const timerIntervalRef = useRef(null);
    const questionStartTimeRef = useRef(null);
    const isReviewMode = location.state?.review || false;
    const reviewQuestionIndex = location.state?.questionIndex;

    // State variables...
    const [allQuizQuestions, setAllQuizQuestions] = useState([]);
    const [displayableQuizData, setDisplayableQuizData] = useState([]); // Still useful for review mode/error handling
    const [quizMetadata, setQuizMetadata] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [submittedAnswers, setSubmittedAnswers] = useState({});
    const [showExplanation, setShowExplanation] = useState({});
    const [crossedOffOptions, setCrossedOffOptions] = useState({});
    const [userTimeSpent, setUserTimeSpent] = useState({});
    const [markedQuestions, setMarkedQuestions] = useState({});
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerValue, setTimerValue] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [initialDuration, setInitialDuration] = useState(0);
    const isMountedRef = useRef(true);
    const stateRef = useRef();

    // --- localStorage Key ---
    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    // --- Save State to localStorage ---
    stateRef.current = {
        currentQuestionIndex, userAnswers, submittedAnswers, crossedOffOptions,
        userTimeSpent, timerValue, isCountdown, initialDuration, markedQuestions
    };
    const saveState = useCallback(() => {
        if (isReviewMode || !isMountedRef.current) return;
        const stateToSave = {
            ...stateRef.current,
            crossedOffOptions: Object.fromEntries(
                Object.entries(stateRef.current.crossedOffOptions).map(([key, valueSet]) => [
                    key, Array.from(valueSet instanceof Set ? valueSet : new Set())
                ])
            ),
        };
        try {
            localStorage.setItem(getQuizStateKey(), JSON.stringify(stateToSave));
        } catch (e) { console.error("[QuizPage] Error saving state:", e); }
    }, [getQuizStateKey, isReviewMode]);

    // --- Load State from localStorage ---
    const loadSavedStateAndInitialize = useCallback((data, metadata) => {
        console.log("[QuizPage] loadSavedStateAndInitialize called");
        let stateLoaded = false;
        if (isReviewMode) {
            console.log("[QuizPage] -> Review mode detected");
            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResults = localStorage.getItem(resultsKey);
             if(savedResults) {
                try {
                    const parsedResults = JSON.parse(savedResults);
                    setUserAnswers(parsedResults.userAnswers || {});
                    setMarkedQuestions(parsedResults.markedQuestions || {});
                    const allSubmitted = {};
                    data.forEach((q, index) => { if (q && !q.error) allSubmitted[index] = true; });
                    setSubmittedAnswers(allSubmitted);
                    const jumpToIndex = reviewQuestionIndex ?? 0;
                    setCurrentQuestionIndex(jumpToIndex);
                    setShowExplanation({ [jumpToIndex]: true });
                    stateLoaded = true;
                } catch(e) { console.error("Error parsing results for review:", e)}
             } else {
                 console.warn("[QuizPage] -> No results found for review.");
                 const allSubmitted = {};
                 data.filter(q => q && !q.error).forEach((_, index) => { allSubmitted[index] = true; });
                 setSubmittedAnswers(allSubmitted);
                 const jumpToIndex = reviewQuestionIndex ?? 0;
                 setCurrentQuestionIndex(jumpToIndex);
                 setShowExplanation({ [jumpToIndex]: true });
                 stateLoaded = true;
             }
            setIsTimerActive(false); setTimerValue(0); setIsCountdown(false);
        } else {
            const savedStateString = localStorage.getItem(getQuizStateKey());
            if (savedStateString) {
                try {
                    const savedState = JSON.parse(savedStateString);
                    console.log("[QuizPage] -> Found In-Progress State:", savedState);
                    setCurrentQuestionIndex(savedState.currentQuestionIndex || 0);
                    setUserAnswers(savedState.userAnswers || {});
                    setSubmittedAnswers(savedState.submittedAnswers || {});
                    const loadedCrossed = {};
                    for (const qIndex in savedState.crossedOffOptions) {
                        if (Array.isArray(savedState.crossedOffOptions[qIndex])) {
                            loadedCrossed[qIndex] = new Set(savedState.crossedOffOptions[qIndex]);
                        }
                    }
                    setCrossedOffOptions(loadedCrossed || {});
                    setUserTimeSpent(savedState.userTimeSpent || {});
                    setMarkedQuestions(savedState.markedQuestions || {});
                    setTimerValue(savedState.timerValue !== undefined ? savedState.timerValue : 0);
                    setIsCountdown(savedState.isCountdown !== undefined ? savedState.isCountdown : false);
                    setInitialDuration(savedState.initialDuration || 0);
                    if (!(savedState.isCountdown && savedState.timerValue <= 0)) {
                        setIsTimerActive(true);
                    } else { setIsTimerActive(false); }
                    stateLoaded = true;
                } catch (e) {
                    console.error("[QuizPage] -> Error loading saved state:", e);
                    localStorage.removeItem(getQuizStateKey());
                }
            } else { console.log("[QuizPage] -> No in-progress state found."); }
        }
        if (!stateLoaded && !isReviewMode) {
            console.log("[QuizPage] -> Initializing NEW quiz state.");
            setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
            setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
            setMarkedQuestions({});
            if (sectionType === 'practice') {
                 const duration = PRACTICE_TEST_DURATIONS[topicId] || PRACTICE_TEST_DURATIONS.default;
                 setTimerValue(duration); setInitialDuration(duration);
                 setIsCountdown(true); setIsTimerActive(true);
            } else if (sectionType === 'qbank') {
                 setTimerValue(0); setIsCountdown(false); setIsTimerActive(true);
             }
        }
        console.log("[QuizPage] loadSavedStateAndInitialize finished");
    }, [getQuizStateKey, isReviewMode, reviewQuestionIndex, topicId, sectionType, quizId]); // Removed data deps

    // --- Data Loading Effect ---
    useEffect(() => {
        console.log("[QuizPage] Mount/Param Change Effect Triggered.");
        isMountedRef.current = true;
        setIsLoading(true); setError(null);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        try {
            const data = getQuizData(topicId, sectionType, quizId);
            const metadata = getQuizMetadata(topicId, sectionType, quizId);
            if (!data || !metadata) throw new Error(`Quiz data/metadata not found.`);
            setAllQuizQuestions(data);
            // Set displayable data based on raw data length for navigation/progress
            setDisplayableQuizData(data); // Use raw data for navigation counts
            setQuizMetadata(metadata);
            console.log("[QuizPage] Data loaded. Raw count:", data.length);
            loadSavedStateAndInitialize(data, metadata);
        } catch (err) {
            console.error('[QuizPage] Error loading quiz data:', err);
            setError(err.message || 'Failed to load quiz.');
            setAllQuizQuestions([]); setDisplayableQuizData([]); setQuizMetadata(null);
        } finally {
             if(isMountedRef.current) setIsLoading(false);
             console.log("[QuizPage] Data loading effect finished.");
        }
        return () => {
            isMountedRef.current = false;
            saveState();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topicId, sectionType, quizId]); // Only depend on ID params

    // --- Timer Effect ---
    useEffect(() => {
        if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } // Clear previous first
        if (isTimerActive && !isReviewMode) {
            console.log("[QuizPage] Timer Effect: Starting Interval. Countdown:", isCountdown, "Value:", timerValue);
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current); timerIntervalRef.current = null;
                            setIsTimerActive(false);
                            alert("Time's up!");
                            handleFinishQuiz(true);
                            return 0;
                        }
                        return newTime;
                    } else { return prevTime + 1; }
                });
            }, 1000);
        } else { console.log("[QuizPage] Timer Effect: Timer inactive or review mode."); }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTimerActive, isCountdown, isReviewMode]);

    // --- Effect to Record Question Start Time ---
     useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else { questionStartTimeRef.current = null; }
        }
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, isReviewMode]);


    // --- Event Handlers ---
    const handleOptionSelect = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    };

    // Internal function - called by the main Submit button
    const submitAnswerForIndex = (questionIndex) => {
        console.log(`[QuizPage] submitAnswerForIndex called for Q${questionIndex + 1}`);
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (!questionToSubmit || questionToSubmit.error) {
            console.log(" -> Cannot submit an error question.");
            return 'error_question'; // Indicate error question encountered
        }
        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex] && !isReviewMode) {
            let elapsedSeconds = -1;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                console.log(`[QuizPage] -> Time spent: ${elapsedSeconds}s`);
                questionStartTimeRef.current = null;
            } else { console.warn(`[QuizPage] -> Could not record time.`); }

            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));
            setTimeout(saveState, 0); // Save state after updates
            console.log(`[QuizPage] -> Answer submitted and state save scheduled.`);
            return true; // Indicate success
        } else if (!userAnswers[questionIndex] && !isReviewMode) {
            alert("Please select an answer before submitting.");
            return false; // Indicate failure (no answer)
        } else { // Already submitted or in review mode
            return true; // Allow navigation even if already submitted
        }
    };

    const toggleExplanation = (questionIndex) => {
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    };

    const handleToggleCrossOff = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode) {
            setCrossedOffOptions(prev => {
                const currentSet = prev[questionIndex] ? new Set(prev[questionIndex]) : new Set();
                if (currentSet.has(optionLabel)) { currentSet.delete(optionLabel); }
                else { currentSet.add(optionLabel); }
                if (currentSet.has(userAnswers[questionIndex])) {
                    setUserAnswers(prevUserAnswers => {
                        const updatedAnswers = { ...prevUserAnswers };
                        delete updatedAnswers[questionIndex];
                        return updatedAnswers;
                    });
                }
                return { ...prev, [questionIndex]: currentSet };
            });
            setTimeout(saveState, 0);
        }
    };

    const handleToggleMark = (questionIndex) => {
        if (!isReviewMode) {
            setMarkedQuestions(prev => {
                const newState = { ...prev };
                newState[questionIndex] = !newState[questionIndex];
                return newState;
            });
            setTimeout(saveState, 0);
        }
    };

    const handleJumpToQuestion = (index) => {
        if (index >= 0 && index < allQuizQuestions.length) {
            // Don't save state when jumping from review modal
            setCurrentQuestionIndex(index);
            setIsReviewModalOpen(false);
        }
     };

    // Handler for the main BLUE Submit button in navigation
    const handleSubmitAndNavigate = () => {
        console.log(`[QuizPage] Submit Button clicked for Q${currentQuestionIndex + 1}`);
        const submissionResult = submitAnswerForIndex(currentQuestionIndex);

        // Navigate to next question ONLY if submission succeeded OR was an error question
        // AND it's not the last question
        if ((submissionResult === true || submissionResult === 'error_question') && currentQuestionIndex < allQuizQuestions.length - 1) {
            console.log(` -> Navigating to Next Question`);
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else if ((submissionResult === true || submissionResult === 'error_question') && currentQuestionIndex === allQuizQuestions.length - 1) {
             console.log(" -> Submit clicked on last question - finishing quiz.");
             handleFinishQuiz(false); // Finish if on last question after submitting
        }
        // If submission failed (false - e.g., no answer selected), do nothing further.
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            saveState(); // Save before navigating
            questionStartTimeRef.current = null;
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    // --- Finish Quiz Logic (Corrected Calculation) ---
    const handleFinishQuiz = (timedOut = false) => {
        console.log(`[QuizPage] handleFinishQuiz called.`);
        if (isReviewMode) { navigate(`/results/${topicId}/${sectionType}/${quizId}`); return; }
        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const finalState = stateRef.current;
        let score = 0; let correctIndices = []; let incorrectIndices = [];
        const totalPossibleScore = allQuizQuestions.length;
        const totalValidQuestions = allQuizQuestions.filter(q => q && !q.error).length;

        allQuizQuestions.forEach((q, index) => {
            if (!q || q.error) return;
            const userAnswerLabel = finalState.userAnswers[index];
            const isSubmitted = !!finalState.submittedAnswers[index];
            const correctOption = q.options?.find(opt => opt.is_correct === true);
            const correctAnswerLabel = correctOption?.label;
            const isAnswerCorrect = userAnswerLabel !== undefined && userAnswerLabel === correctAnswerLabel;
            if (isSubmitted && isAnswerCorrect) { score++; correctIndices.push(index); }
            else if (isSubmitted) { incorrectIndices.push(index); }
            else { if (timedOut || sectionType === 'practice') { incorrectIndices.push(index); } }
        });

        const results = { score, totalQuestions: totalPossibleScore, totalValidQuestions, correctIndices, incorrectIndices, userAnswers: finalState.userAnswers, userTimeSpent: finalState.userTimeSpent, markedQuestions: finalState.markedQuestions, timestamp: Date.now(), quizName: quizMetadata?.name || 'Quiz', topicName: topicId };
        console.log("[QuizPage] Calculated Results Object:", results);
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        try { localStorage.setItem(resultsKey, JSON.stringify(results)); }
        catch (e) { console.error("Error saving results:", e); }
        localStorage.removeItem(getQuizStateKey());
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    };


    // --- Render Logic ---
    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    if (!allQuizQuestions || allQuizQuestions.length === 0) return ( <div className="page-info"> No questions found for this quiz. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );

    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    const currentIsSubmitted = !!submittedAnswers[currentQuestionIndex] || isReviewMode;
    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOff = crossedOffOptions[currentQuestionIndex] || new Set();
    const currentIsMarked = !!markedQuestions[currentQuestionIndex];

     if (!currentQuestionData) {
         console.error(`Error: No question data found at index ${currentQuestionIndex}`);
         return <div className="page-error">Error displaying question. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
     }

    const totalQuestionsForDisplay = quizMetadata?.totalQuestions || 0;
    const isCurrentQuestionError = !!currentQuestionData.error;

    return (
        <div className="quiz-page-container">
             {/* Header */}
            <div className="quiz-header">
                 <button onClick={() => isReviewMode ? navigate(`/results/${topicId}/${sectionType}/${quizId}`) : navigate(`/topic/${topicId}`)} className="back-button-quiz">
                    {isReviewMode ? `\u21A9 Back to Results` : `\u21A9 Back to ${formatDisplayName(topicId)}`}
                </button>
                <div className="quiz-title-container">
                    <h1 className="quiz-title">{quizMetadata?.name || 'Quiz'}</h1>
                </div>
                <p className="quiz-progress">
                    Question {currentQuestionIndex + 1} of {totalQuestionsForDisplay}
                </p>
            </div>

             {/* Top Controls */}
            <div className="quiz-controls-top">
                 {!isReviewMode && ( <button onClick={() => setIsReviewModalOpen(true)} className="review-button-inline"> Review Questions </button> )}
                 {!isReviewMode && ( <div className="timer-display">
                     {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
                     <span className={isCountdown && timerValue < 60 ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
                     {isCountdown && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
                 </div> )}
                 {isReviewMode && <div style={{minWidth: '130px'}}></div>}
                 {isReviewMode && <div style={{minWidth: '130px'}}></div>}
            </div>

             {/* Question Card */}
            <div className="quiz-content-area">
                <QuestionCard
                    questionData={currentQuestionData}
                    questionIndex={currentQuestionIndex}
                    selectedOption={userAnswers[currentQuestionIndex]}
                    isSubmitted={currentIsSubmitted}
                    showExplanation={showExplanation[currentQuestionIndex] || (isReviewMode && !isCurrentQuestionError)}
                    crossedOffOptions={currentCrossedOff}
                    userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]}
                    isReviewMode={isReviewMode}
                    isMarked={currentIsMarked}
                    onOptionSelect={handleOptionSelect}
                    // Pass internal submit handler to Card's button
                    onViewAnswer={() => submitAnswerForIndex(currentQuestionIndex)}
                    onToggleExplanation={toggleExplanation}
                    onToggleCrossOff={handleToggleCrossOff}
                    onToggleMark={handleToggleMark} // Mark button is now in Nav
                />
            </div>

             {/* Navigation */}
            <div className="quiz-navigation">
                 <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="nav-button prev-button"
                > Previous </button>

                 {!isReviewMode && (
                    <button
                        onClick={() => handleToggleMark(currentQuestionIndex)}
                        className={`mark-button-nav ${currentIsMarked ? 'marked' : ''}`}
                        title={currentIsMarked ? "Unmark this question" : "Mark for review"}
                        disabled={isCurrentQuestionError}
                    >
                       {currentIsMarked ? '🚩 Unmark' : '🏳️ Mark'}
                    </button>
                 )}
                 {isReviewMode && <div className="mark-button-nav-placeholder" style={{minWidth: '90px', margin: '0 15px'}}></div>}

                {/* Submit/Finish Button Logic */}
                {(isLastQuestion || isReviewMode) ? (
                    <button onClick={() => handleFinishQuiz(false)} className="nav-button submit-quiz-button">
                        {isReviewMode ? 'Back to Results' : 'Finish Quiz'}
                    </button>
                ) : (
                    <button
                        onClick={handleSubmitAndNavigate} // Use the handler that submits THEN navigates
                        className="nav-button submit-button"
                        disabled={isCurrentQuestionError}
                    > Submit </button> // Text is "Submit" (acts like Next + Submit)
                )}
            </div>

             {/* Review Modal */}
            <ReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                questions={allQuizQuestions}
                markedQuestions={markedQuestions}
                submittedAnswers={submittedAnswers}
                onJumpToQuestion={handleJumpToQuestion}
                currentQuestionIndex={currentQuestionIndex}
                onFinishQuiz={handleFinishQuiz}
            />
        </div>
    );
}

export default QuizPage;