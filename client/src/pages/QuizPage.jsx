// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import ReviewModal from '../components/ReviewModal';
import '../styles/QuizPage.css';

// --- Timer Configuration --- UPDATED
const PRACTICE_TEST_DURATIONS = {
    biology: 30 * 60, // Updated from 20 to 30 minutes
    chemistry: 30 * 60,
    'perceptual-ability': 60 * 60,
    'reading-comprehension': 60 * 60,
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

    const [passageHtml, setPassageHtml] = useState(null);
    const [tempReveal, setTempReveal] = useState({});

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
                    data.forEach((_, index) => {
                        allSubmitted[index] = true;
                    });
                    setSubmittedAnswers(allSubmitted);
                    const jumpToIndex = reviewQuestionIndex !== undefined && reviewQuestionIndex !== null ? reviewQuestionIndex : 0;
                    setCurrentQuestionIndex(jumpToIndex);
                    setShowExplanation({ [jumpToIndex]: true });
                    stateLoaded = true;
                } catch(e) { console.error("Error parsing results for review:", e)}
             } else {
                 const allSubmitted = {};
                 data.forEach((_, index) => { allSubmitted[index] = true; });
                 setSubmittedAnswers(allSubmitted);
                 const jumpToIndex = reviewQuestionIndex ?? 0;
                 setCurrentQuestionIndex(jumpToIndex);
                 setShowExplanation({ [jumpToIndex]: true });
                 stateLoaded = true;
             }
            setIsTimerActive(false); setTimerValue(0); setIsCountdown(false);
            setTempReveal({});
        } else {
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
                    setTempReveal({});

                    if (!(savedState.isCountdown && savedState.timerValue <= 0)) {
                        setIsTimerActive(true);
                    } else { setIsTimerActive(false); }
                    stateLoaded = true;
                } catch (e) {
                    console.error("[QuizPage] -> Error loading saved state:", e);
                    localStorage.removeItem(getQuizStateKey());
                }
            }
        }

        if (!stateLoaded && !isReviewMode) {
            setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
            setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
            setMarkedQuestions({}); setTempReveal({});
            const topicTimerKey = topicId.toLowerCase().replace(/\s+/g, '-');
            if (sectionType === 'practice') {
                 const duration = PRACTICE_TEST_DURATIONS[topicTimerKey] || PRACTICE_TEST_DURATIONS.default;
                 setTimerValue(duration); setInitialDuration(duration);
                 setIsCountdown(true); setIsTimerActive(true);
            } else if (sectionType === 'qbank') {
                 setTimerValue(0); setIsCountdown(false); setIsTimerActive(true);
                 setInitialDuration(0);
            }
        }
    }, [getQuizStateKey, isReviewMode, reviewQuestionIndex, topicId, sectionType, quizId]);

    useEffect(() => {
        isMountedRef.current = true;
        setIsLoading(true); setError(null); // setPassageHtml(null) removed from here for clarity, will be handled by its own effect.
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        try {
            const loadedQuizData = getQuizData(topicId, sectionType, quizId);
            const loadedQuizMetadata = getQuizMetadata(topicId, sectionType, quizId);

            if (!loadedQuizData || loadedQuizData.length === 0 || !loadedQuizMetadata) {
                throw new Error(`Quiz data or metadata not found, or quiz is empty.`);
            }

            setAllQuizQuestions(loadedQuizData);
            setQuizMetadata(loadedQuizMetadata);
            // Initial passage setting is removed from here and handled by the new useEffect below
            loadSavedStateAndInitialize(loadedQuizData, loadedQuizMetadata);
        } catch (err) {
            console.error('[QuizPage] Error loading quiz data:', err);
            setError(err.message || 'Failed to load quiz.');
            setAllQuizQuestions([]); setQuizMetadata(null);
        } finally {
             if(isMountedRef.current) setIsLoading(false);
        }
        return () => {
            isMountedRef.current = false;
            saveState();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, loadSavedStateAndInitialize]);

    // *** NEW useEffect to update passageHtml based on currentQuestionIndex ***
    useEffect(() => {
        if (allQuizQuestions && allQuizQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < allQuizQuestions.length) {
            const currentQData = allQuizQuestions[currentQuestionIndex];
            if (currentQData && !currentQData.error && currentQData.passage && currentQData.passage.html_content) {
                setPassageHtml(currentQData.passage.html_content);
            } else {
                // If current question has no passage or is an error, clear passage display
                setPassageHtml(null);
            }
        } else {
            setPassageHtml(null); // Clear passage if questions/index are invalid
        }
    }, [currentQuestionIndex, allQuizQuestions]);
    // *** END NEW useEffect ***

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
                            handleFinishQuiz(true);
                            return 0;
                        }
                        return newTime;
                    } else { return prevTime + 1; }
                });
            }, 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isTimerActive, isCountdown, isReviewMode]); // Added handleFinishQuiz to dependency array if it's used inside, but it's called, not defined here.

     useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex] && !tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else {
                questionStartTimeRef.current = null;
            }
        }
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, isReviewMode, tempReveal]);

    const toggleSolutionReveal = useCallback(() => {
        if (sectionType === 'qbank' && !isReviewMode && allQuizQuestions[currentQuestionIndex] && !allQuizQuestions[currentQuestionIndex].error) {
            setTempReveal(prev => {
                const newRevealState = !prev[currentQuestionIndex];
                setShowExplanation(prevExp => ({
                    ...prevExp,
                    [currentQuestionIndex]: newRevealState
                }));
                if (newRevealState && questionStartTimeRef.current) {
                    const endTime = Date.now();
                    const elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                    setUserTimeSpent(prevTS => ({ ...prevTS, [currentQuestionIndex]: (prevTS[currentQuestionIndex] || 0) + elapsedSeconds }));
                    questionStartTimeRef.current = null;
                }
                return {...prev, [currentQuestionIndex]: newRevealState};
            });
        }
    }, [sectionType, isReviewMode, allQuizQuestions, currentQuestionIndex, setUserTimeSpent]);

    useEffect(() => {
        const handleKeyPress = (event) => {
            if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                toggleSolutionReveal();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [toggleSolutionReveal]);


    const handleOptionSelect = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex]) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    };

    const submitAnswerForIndex = (questionIndex) => {
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (!questionToSubmit || questionToSubmit.error) {
            return 'error_question';
        }
        if (isReviewMode || tempReveal[questionIndex]) {
            return true;
        }
        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex]) {
            let elapsedSeconds = userTimeSpent[questionIndex] !== undefined ? userTimeSpent[questionIndex] : 0;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                questionStartTimeRef.current = null;
            }
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));
            setTimeout(saveState, 0);
            return true;
        } else if (submittedAnswers[questionIndex]) {
            return true;
        }
        return 'no_answer_selected';
    };

    const toggleExplanation = (questionIndex) => {
        if (sectionType === 'qbank' && tempReveal[questionIndex] !== undefined) {
             setTempReveal(prev => ({...prev, [questionIndex]: !showExplanation[questionIndex] }));
        }
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    };

    const handleToggleCrossOff = (questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex]) {
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
            if (tempReveal[currentQuestionIndex]) {
                setTempReveal(prev => ({...prev, [currentQuestionIndex]: false}));
            }
            setCurrentQuestionIndex(index);
            if (isReviewMode) {
                setShowExplanation({ [index]: true });
            } else {
                setTempReveal(prev => ({...prev, [index]: false}));
            }
            setIsReviewModalOpen(false);
        }
     };

    const handleSubmitAndNavigate = () => {
        submitAnswerForIndex(currentQuestionIndex);
        if (tempReveal[currentQuestionIndex]) {
            setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
        }
        if (currentQuestionIndex < allQuizQuestions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setTempReveal(prev => ({ ...prev, [currentQuestionIndex + 1]: false }));
            if (!submittedAnswers[currentQuestionIndex + 1]) {
                 setShowExplanation(prev => ({ ...prev, [currentQuestionIndex + 1]: false }));
            }
        } else {
             handleFinishQuiz(false);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            if (tempReveal[currentQuestionIndex]) {
                setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
            }
            setCurrentQuestionIndex(currentQuestionIndex - 1);
             setTempReveal(prev => ({ ...prev, [currentQuestionIndex - 1]: false }));
             if (!submittedAnswers[currentQuestionIndex -1] && !tempReveal[currentQuestionIndex -1]) {
                setShowExplanation(prev => ({ ...prev, [currentQuestionIndex - 1]: false }));
             }
        }
    };

    const handleFinishQuiz = useCallback((timedOut = false) => {
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

            if (isSubmitted) {
                if (userAnswerLabel !== undefined && userAnswerLabel === correctAnswerLabel) {
                    score++;
                    correctIndices.push(index);
                } else {
                    incorrectIndices.push(index);
                }
            } else if (timedOut && sectionType === 'practice') {
                incorrectIndices.push(index);
            }
        });

        const results = {
            score, totalQuestions: totalPossibleScore, totalValidQuestions,
            correctIndices, incorrectIndices, userAnswers: finalState.userAnswers,
            userTimeSpent: finalState.userTimeSpent, markedQuestions: finalState.markedQuestions,
            timestamp: Date.now(), quizName: quizMetadata?.name || 'Quiz',
            topicName: formatDisplayName(topicId)
        };
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        try { localStorage.setItem(resultsKey, JSON.stringify(results)); }
        catch (e) { console.error("Error saving results:", e); }
        localStorage.removeItem(getQuizStateKey());
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    }, [allQuizQuestions, quizMetadata, getQuizStateKey, isReviewMode, navigate, sectionType, topicId, quizId]);


    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    if (!allQuizQuestions || allQuizQuestions.length === 0) return ( <div className="page-info"> No questions found for this quiz. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );

    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    const displayAsSubmitted = !!submittedAnswers[currentQuestionIndex] || isReviewMode || !!tempReveal[currentQuestionIndex];
    const displayExplanation = !!showExplanation[currentQuestionIndex] || (isReviewMode && !currentQuestionData?.error) || !!tempReveal[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOff = crossedOffOptions[currentQuestionIndex] || new Set();
    const currentIsMarked = !!markedQuestions[currentQuestionIndex];
    const isCurrentQuestionError = !!currentQuestionData?.error;

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

            {passageHtml && (
                <div className="passage-container">
                    <div className="passage-content" dangerouslySetInnerHTML={{ __html: passageHtml }} />
                </div>
            )}

            <div className="quiz-controls-top">
                 {!isReviewMode && ( <div className="timer-display">
                     {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
                     <span className={isCountdown && timerValue < 60 && timerValue > 0 ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
                     {isCountdown && initialDuration > 0 && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
                 </div> )}
                 {isReviewMode && <div className="timer-display-placeholder"></div>}
            </div>

            <div className="quiz-content-area">
                <QuestionCard
                    questionData={currentQuestionData}
                    questionIndex={currentQuestionIndex}
                    selectedOption={userAnswers[currentQuestionIndex]}
                    isSubmitted={displayAsSubmitted}
                    showExplanation={displayExplanation}
                    crossedOffOptions={currentCrossedOff}
                    userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]}
                    isReviewMode={isReviewMode}
                    isMarked={currentIsMarked}
                    onOptionSelect={handleOptionSelect}
                    onViewAnswer={() => submitAnswerForIndex(currentQuestionIndex)}
                    onToggleExplanation={toggleExplanation}
                    onToggleCrossOff={handleToggleCrossOff}
                    onToggleMark={handleToggleMark}
                    isTemporarilyRevealed={!!tempReveal[currentQuestionIndex]}
                />
            </div>

            <div className="quiz-navigation">
                <div className="nav-group-left">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestionIndex === 0}
                        className="nav-button prev-button"
                    > Previous </button>

                    {sectionType === 'qbank' && !isReviewMode && !isCurrentQuestionError && (
                        <button onClick={toggleSolutionReveal} className="nav-button solution-toggle-button-bottom">
                            {tempReveal[currentQuestionIndex] ? "Hide Solution" : "'S' Solution"}
                        </button>
                    )}
                </div>

                <div className="nav-group-center">
                    {(isLastQuestion || (isReviewMode && isLastQuestion) ) ? (
                        <button onClick={() => handleFinishQuiz(false)} className="nav-button submit-quiz-button">
                            {isReviewMode ? 'Back to Results' : 'Finish Quiz'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmitAndNavigate}
                            className="nav-button next-button"
                            disabled={isCurrentQuestionError}
                        > Next </button>
                    )}
                </div>

                <div className="nav-group-right">
                    {!isReviewMode && !isCurrentQuestionError && (
                        <button
                            onClick={() => handleToggleMark(currentQuestionIndex)}
                            className={`mark-button-nav ${currentIsMarked ? 'marked' : ''}`}
                            title={currentIsMarked ? "Unmark this question" : "Mark for review"}
                        >
                        {currentIsMarked ? '🚩 Unmark' : '🏳️ Mark'}
                        </button>
                    )}
                     {isReviewMode && <div className="mark-button-nav-placeholder"></div>}


                    {!isReviewMode && (
                        <button onClick={() => setIsReviewModalOpen(true)} className="nav-button review-button-bottom">
                            Review
                        </button>
                    )}
                     {isReviewMode && <div className="review-button-bottom-placeholder"></div>}
                </div>
            </div>

            <ReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                questions={allQuizQuestions}
                markedQuestions={markedQuestions}
                submittedAnswers={submittedAnswers}
                onJumpToQuestion={handleJumpToQuestion}
                currentQuestionIndex={currentQuestionIndex}
                onFinishQuiz={() => handleFinishQuiz(false)}
            />
        </div>
    );
}

export default QuizPage;