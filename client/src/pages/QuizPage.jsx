// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader'; // formatDisplayName might be needed for topic title
import QuestionCard from '../components/QuestionCard';
import ReviewModal from '../components/ReviewModal';
import '../styles/QuizPage.css'; // Ensure this path is correct

// --- Timer Configuration ---
const PRACTICE_TEST_DURATIONS = {
    biology: 20 * 60,
    chemistry: 30 * 60,
    'perceptual-ability': 60 * 60,
    'reading-comprehension': 60 * 60, // Added entry for reading-comprehension
    default: 30 * 60
};

const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function QuizPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const timerIntervalRef = useRef(null);
    const questionStartTimeRef = useRef(null);
    const isReviewMode = location.state?.review || false;
    const reviewQuestionIndex = location.state?.questionIndex;

    const [allQuizQuestions, setAllQuizQuestions] = useState([]);
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

    const [passageHtml, setPassageHtml] = useState(null); // State for passage HTML

    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

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

    const loadSavedStateAndInitialize = useCallback((data, metadata) => {
        let stateLoaded = false;
        if (isReviewMode) {
            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResults = localStorage.getItem(resultsKey);
             if(savedResults) {
                try {
                    const parsedResults = JSON.parse(savedResults);
                    setUserAnswers(parsedResults.userAnswers || {});
                    setMarkedQuestions(parsedResults.markedQuestions || {});
                    const allSubmitted = {};
                    data.forEach((_, index) => { // Changed from data.forEach((q, index) => { if (q && !q.error)
                        // In review mode, all questions are "submittable" for viewing
                        allSubmitted[index] = true;
                    });
                    setSubmittedAnswers(allSubmitted);

                    const jumpToIndex = reviewQuestionIndex !== undefined && reviewQuestionIndex !== null ? reviewQuestionIndex : 0;
                    setCurrentQuestionIndex(jumpToIndex);
                    setShowExplanation({ [jumpToIndex]: true }); // Show explanation for the jumped-to question
                    stateLoaded = true;
                } catch(e) { console.error("Error parsing results for review:", e)}
             } else {
                 // Fallback for review mode if no results found (e.g., direct navigation)
                 const allSubmitted = {};
                 data.forEach((_, index) => { allSubmitted[index] = true; });
                 setSubmittedAnswers(allSubmitted);
                 const jumpToIndex = reviewQuestionIndex ?? 0;
                 setCurrentQuestionIndex(jumpToIndex);
                 setShowExplanation({ [jumpToIndex]: true });
                 stateLoaded = true;
             }
            setIsTimerActive(false); setTimerValue(0); setIsCountdown(false);
        } else { // Not review mode
            const savedStateString = localStorage.getItem(getQuizStateKey());
            if (savedStateString) {
                try {
                    const savedState = JSON.parse(savedStateString);
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
                    localStorage.removeItem(getQuizStateKey()); // Clear corrupted state
                }
            }
        }

        if (!stateLoaded && !isReviewMode) { // Fresh start for a quiz (not review, no saved state)
            setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
            setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
            setMarkedQuestions({});
            // Timer setup for practice tests or question banks
            const topicTimerKey = topicId.toLowerCase().replace(/\s+/g, '-');
            if (sectionType === 'practice') {
                 const duration = PRACTICE_TEST_DURATIONS[topicTimerKey] || PRACTICE_TEST_DURATIONS.default;
                 setTimerValue(duration); setInitialDuration(duration);
                 setIsCountdown(true); setIsTimerActive(true);
            } else if (sectionType === 'qbank') {
                 setTimerValue(0); setIsCountdown(false); setIsTimerActive(true); // Simple stopwatch for QBank
                 setInitialDuration(0);
            }
        }
    }, [getQuizStateKey, isReviewMode, reviewQuestionIndex, topicId, sectionType, quizId]);

    useEffect(() => {
        isMountedRef.current = true;
        setIsLoading(true); setError(null); setPassageHtml(null); // Reset passage on new quiz load
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        try {
            const loadedQuizData = getQuizData(topicId, sectionType, quizId); // This is the array of question objects
            const loadedQuizMetadata = getQuizMetadata(topicId, sectionType, quizId);

            if (!loadedQuizData || loadedQuizData.length === 0 || !loadedQuizMetadata) {
                throw new Error(`Quiz data or metadata not found, or quiz is empty.`);
            }

            setAllQuizQuestions(loadedQuizData);
            setQuizMetadata(loadedQuizMetadata);

            // Extract passage HTML from the first question object if it exists
            // (assuming passage is the same for all questions in this quiz file)
            if (loadedQuizData[0]?.passage?.html_content) {
                setPassageHtml(loadedQuizData[0].passage.html_content);
            }

            loadSavedStateAndInitialize(loadedQuizData, loadedQuizMetadata);

        } catch (err) {
            console.error('[QuizPage] Error loading quiz data:', err);
            setError(err.message || 'Failed to load quiz.');
            setAllQuizQuestions([]); setQuizMetadata(null); setPassageHtml(null);
        } finally {
             if(isMountedRef.current) setIsLoading(false);
        }
        return () => {
            isMountedRef.current = false;
            saveState(); // Save state on unmount/change if not in review mode
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, loadSavedStateAndInitialize]); // loadSavedStateAndInitialize is a dependency

    useEffect(() => {
        if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
        if (isTimerActive && !isReviewMode) {
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current); timerIntervalRef.current = null;
                            setIsTimerActive(false);
                            alert("Time's up!");
                            handleFinishQuiz(true); // Pass true for timedOut
                            return 0;
                        }
                        return newTime;
                    } else { return prevTime + 1; }
                });
            }, 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isTimerActive, isCountdown, isReviewMode]); // Removed handleFinishQuiz from deps

     useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            // Only reset start time if question is not yet submitted
            if (currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else {
                questionStartTimeRef.current = null; // No timing for submitted/error questions
            }
        }
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, isReviewMode]);


    const handleOptionSelect = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    };

    const submitAnswerForIndex = (questionIndex) => {
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (!questionToSubmit || questionToSubmit.error) {
            return 'error_question';
        }
        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex] && !isReviewMode) {
            let elapsedSeconds = userTimeSpent[questionIndex] !== undefined ? userTimeSpent[questionIndex] : 0; // Keep existing time if re-submitting (though UI prevents this)
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                questionStartTimeRef.current = null; // Reset for next question or if user navigates away and back
            }
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));
            setTimeout(saveState, 0);
            return true;
        } else if (!userAnswers[questionIndex] && !isReviewMode) {
            alert("Please select an answer before submitting.");
            return false;
        }
        return true; // Already submitted or in review mode, allow navigation
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
            setCurrentQuestionIndex(index);
            if (isReviewMode) { // In review mode, always show explanation for jumped-to question
                setShowExplanation({ [index]: true });
            }
            setIsReviewModalOpen(false);
        }
     };

    const handleSubmitAndNavigate = () => {
        const submissionResult = submitAnswerForIndex(currentQuestionIndex);
        if ((submissionResult === true || submissionResult === 'error_question') && currentQuestionIndex < allQuizQuestions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else if ((submissionResult === true || submissionResult === 'error_question') && currentQuestionIndex === allQuizQuestions.length - 1) {
             handleFinishQuiz(false);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            // No need to explicitly saveState here, it's handled by useEffect on currentQuestionIndex change if needed
            // or on unmount. Navigating back shouldn't re-record time for already answered questions.
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const handleFinishQuiz = useCallback((timedOut = false) => {
        if (isReviewMode) { navigate(`/results/${topicId}/${sectionType}/${quizId}`); return; }
        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const finalState = stateRef.current; // Use the ref for the most up-to-date state
        let score = 0; let correctIndices = []; let incorrectIndices = [];
        const totalPossibleScore = allQuizQuestions.length;
        const totalValidQuestions = allQuizQuestions.filter(q => q && !q.error).length;

        allQuizQuestions.forEach((q, index) => {
            if (!q || q.error) return; // Skip error questions from scoring
            const userAnswerLabel = finalState.userAnswers[index];
            const isSubmitted = !!finalState.submittedAnswers[index];
            const correctOption = q.options?.find(opt => opt.is_correct === true);
            const correctAnswerLabel = correctOption?.label;

            if (isSubmitted) {
                if (userAnswerLabel !== undefined && userAnswerLabel === correctAnswerLabel) {
                    score++;
                    correctIndices.push(index);
                } else {
                    incorrectIndices.push(index);
                }
            } else if (timedOut && sectionType === 'practice') { // Only mark unsubmitted as incorrect if timed out in practice
                incorrectIndices.push(index);
            }
            // For qbank, unsubmitted & not timed out are just unanswered, not scored against unless explicitly handled
        });

        const results = {
            score,
            totalQuestions: totalPossibleScore, // Total items in JSON
            totalValidQuestions, // Actual scoreable questions
            correctIndices,
            incorrectIndices,
            userAnswers: finalState.userAnswers,
            userTimeSpent: finalState.userTimeSpent, // Use the ref's value
            markedQuestions: finalState.markedQuestions, // Use the ref's value
            timestamp: Date.now(),
            quizName: quizMetadata?.name || 'Quiz',
            topicName: formatDisplayName(topicId) // Use formatted topicId
        };
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        try { localStorage.setItem(resultsKey, JSON.stringify(results)); }
        catch (e) { console.error("Error saving results:", e); }
        localStorage.removeItem(getQuizStateKey()); // Clean up in-progress state
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    }, [allQuizQuestions, quizMetadata, getQuizStateKey, isReviewMode, navigate, sectionType, topicId, quizId]);


    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    if (!allQuizQuestions || allQuizQuestions.length === 0) return ( <div className="page-info"> No questions found for this quiz. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );

    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    const currentIsSubmitted = !!submittedAnswers[currentQuestionIndex] || isReviewMode;
    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOff = crossedOffOptions[currentQuestionIndex] || new Set();
    const currentIsMarked = !!markedQuestions[currentQuestionIndex];
    const isCurrentQuestionError = !!currentQuestionData?.error; // Safe access

     if (!currentQuestionData) {
         return <div className="page-error">Error: Question data missing. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
     }

    const totalQuestionsForDisplay = quizMetadata?.totalQuestions || allQuizQuestions.length;

    return (
        <div className="quiz-page-container">
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

            {/* Passage Display Area - NEW */}
            {passageHtml && (
                <div className="passage-container">
                    {/* Reading Comprehension passages often don't have a separate title from the quiz name itself */}
                    {/* <h2 className="passage-title">Passage</h2> */}
                    <div className="passage-content" dangerouslySetInnerHTML={{ __html: passageHtml }} />
                </div>
            )}

            <div className="quiz-controls-top">
                 {!isReviewMode && ( <button onClick={() => setIsReviewModalOpen(true)} className="review-button-inline"> Review Questions </button> )}
                 {!isReviewMode && ( <div className="timer-display">
                     {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
                     <span className={isCountdown && timerValue < 60 && timerValue > 0 ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
                     {isCountdown && initialDuration > 0 && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
                 </div> )}
                 {isReviewMode && <div style={{minWidth: '130px', visibility: 'hidden'}}></div>} {/* Placeholder for alignment */}
                 {isReviewMode && <div style={{minWidth: '130px', visibility: 'hidden'}}></div>} {/* Placeholder for alignment */}
            </div>

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
                    onViewAnswer={() => submitAnswerForIndex(currentQuestionIndex)}
                    onToggleExplanation={toggleExplanation}
                    onToggleCrossOff={handleToggleCrossOff}
                    onToggleMark={handleToggleMark}
                />
            </div>

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

                {(isLastQuestion || (isReviewMode && isLastQuestion) ) ? ( // Adjusted for review mode finish
                    <button onClick={() => handleFinishQuiz(false)} className="nav-button submit-quiz-button">
                        {isReviewMode ? 'Back to Results' : 'Finish Quiz'}
                    </button>
                ) : (
                    <button
                        onClick={handleSubmitAndNavigate}
                        className="nav-button submit-button" // This button acts as "Submit and Next"
                        disabled={isCurrentQuestionError || (currentIsSubmitted && !isReviewMode)} // Disable if already submitted in non-review
                    > {currentIsSubmitted && !isReviewMode ? 'Next' : 'Submit'} </button>
                )}
            </div>

            <ReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                questions={allQuizQuestions}
                markedQuestions={markedQuestions}
                submittedAnswers={submittedAnswers}
                onJumpToQuestion={handleJumpToQuestion}
                currentQuestionIndex={currentQuestionIndex}
                onFinishQuiz={() => handleFinishQuiz(false)} // Pass false for not timed out
            />
        </div>
    );
}

export default QuizPage;