// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import QuizReviewSummary from '../components/QuizReviewSummary';
import { useLayout } from '../context/LayoutContext';
import '../styles/QuizPage.css';

// ... (debounce, cleanPassageHtml, PRACTICE_TEST_DURATIONS, formatTime, MemoizedPassage, EMPTY_SET remain the same) ...
// Debounce utility
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}

const cleanPassageHtml = (htmlString) => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    let cleanedHtml = htmlString;
    const preMarkRegex = /<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi;
    cleanedHtml = cleanedHtml.replace(preMarkRegex, '$1');
    const MuiButtonRegex = /<button\s+class="MuiButtonBase-root[^"]*"[^>]*data-testid="highlighter-button-id"[^>]*>[\s\S]*?<\/button>/gi;
    cleanedHtml = cleanedHtml.replace(MuiButtonRegex, '');
    cleanedHtml = cleanedHtml.replace(/<mark[^>]*>/gi, '').replace(/<\/mark>/gi, '');
    return cleanedHtml;
};

const PRACTICE_TEST_DURATIONS = {
    biology: 30 * 60,
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

const MemoizedPassage = React.memo(function MemoizedPassage({ html, passageRef }) {
    if (!html) {
        return null;
    }
    return (
        <div
            className="passage-container"
            ref={passageRef}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
});

const EMPTY_SET = new Set();


function QuizPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { isSidebarEffectivelyPinned } = useLayout();

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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerValue, setTimerValue] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [initialDuration, setInitialDuration] = useState(0);
    const isMountedRef = useRef(true);

    const quizPageContainerRef = useRef(null);
    const passageContainerRef = useRef(null);
    const highlightButtonRef = useRef(null);

    const [passageHtml, setPassageHtml] = useState(null);
    const [tempReveal, setTempReveal] = useState({});

    const debouncedSelectionChangeHandlerRef = useRef(null);

    const [isReviewSummaryVisible, setIsReviewSummaryVisible] = useState(false);
    const [currentQuestionIndexBeforeReview, setCurrentQuestionIndexBeforeReview] = useState(0);

    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    const saveState = useCallback(() => {
        if (isReviewMode || !isMountedRef.current) return;
        const stateToSave = {
            currentQuestionIndex, userAnswers, submittedAnswers, userTimeSpent,
            timerValue, isCountdown, initialDuration, markedQuestions, tempReveal, showExplanation,
            isReviewSummaryVisible, currentQuestionIndexBeforeReview,
            crossedOffOptions: Object.fromEntries(
                Object.entries(crossedOffOptions).map(([key, valueSet]) => [
                    key, Array.from(valueSet instanceof Set ? valueSet : new Set())
                ])
            ),
        };
        try {
            localStorage.setItem(getQuizStateKey(), JSON.stringify(stateToSave));
        } catch (e) { console.error("[QuizPage] Error saving state:", e); }
    }, [
        getQuizStateKey, isReviewMode, currentQuestionIndex, userAnswers, submittedAnswers,
        userTimeSpent, timerValue, isCountdown, initialDuration, markedQuestions, tempReveal,
        showExplanation, crossedOffOptions, isReviewSummaryVisible, currentQuestionIndexBeforeReview
    ]);
    const saveStateRef = useRef(saveState);
    useEffect(() => {
        saveStateRef.current = saveState;
    }, [saveState]);

    const handleFinishQuiz = useCallback((timedOut = false) => {
        if (!isMountedRef.current) return;
        setIsTimerActive(false);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (isReviewMode) {
            navigate(`/results/${topicId}/${sectionType}/${quizId}`);
            return;
        }

        let score = 0;
        let correctIndices = [];
        let incorrectIndices = [];

        if (!allQuizQuestions || allQuizQuestions.length === 0 || !quizMetadata) {
            setError("Could not finalize quiz due to missing data. Please try again.");
            return;
        }

        const totalPossibleScore = allQuizQuestions.length;
        const totalValidQuestions = allQuizQuestions.filter(q => q && !q.error).length;

        allQuizQuestions.forEach((q, index) => {
            if (!q || q.error) return;
            const userAnswerLabel = userAnswers[index];
            const isAnswerSubmitted = submittedAnswers[index];
            const correctOption = q.options?.find(opt => opt.is_correct === true);
            const correctAnswerLabel = correctOption?.label;

            if (isAnswerSubmitted) {
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
            correctIndices, incorrectIndices, userAnswers,
            userTimeSpent, markedQuestions,
            timestamp: Date.now(), quizName: quizMetadata.name || 'Quiz',
            topicName: formatDisplayName(topicId)
        };
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        try { localStorage.setItem(resultsKey, JSON.stringify(results)); }
        catch (e) { console.error("Error saving results:", e); }
        localStorage.removeItem(getQuizStateKey());
        setIsReviewSummaryVisible(false);
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    }, [
        allQuizQuestions, quizMetadata, isReviewMode, navigate, sectionType, topicId, quizId,
        userAnswers, submittedAnswers, userTimeSpent, markedQuestions,
        getQuizStateKey, setError
    ]);
    const handleFinishQuizRef = useRef(handleFinishQuiz);
    useEffect(() => {
        handleFinishQuizRef.current = handleFinishQuiz;
    }, [handleFinishQuiz]);


    const loadSavedStateAndInitialize = useCallback((data) => {
        let stateLoaded = false;
        const jumpToFromNav = location.state?.jumpTo;

        if (isReviewMode) {
            setIsReviewSummaryVisible(false);
             const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
             const savedResults = localStorage.getItem(resultsKey);
              if(savedResults) {
                 try {
                     const parsedResults = JSON.parse(savedResults);
                     setUserAnswers(parsedResults.userAnswers || {});
                     setMarkedQuestions(parsedResults.markedQuestions || {});
                     const allSubmitted = {};
                     data.forEach((_, index) => { allSubmitted[index] = true; });
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
                    setTempReveal(savedState.tempReveal || {});
                    setShowExplanation(savedState.showExplanation || {});

                    if (jumpToFromNav === undefined) {
                        setIsReviewSummaryVisible(savedState.isReviewSummaryVisible || false);
                        setCurrentQuestionIndexBeforeReview(savedState.currentQuestionIndexBeforeReview || 0);
                    } else {
                        setIsReviewSummaryVisible(false);
                        setCurrentQuestionIndex(jumpToFromNav);
                        setCurrentQuestionIndexBeforeReview(jumpToFromNav);
                        navigate(location.pathname, { replace: true, state: { ...location.state, jumpTo: undefined } });
                    }

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
            setMarkedQuestions({}); setTempReveal({}); setIsReviewSummaryVisible(false); setCurrentQuestionIndexBeforeReview(0);
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
    }, [getQuizStateKey, isReviewMode, reviewQuestionIndex, topicId, sectionType, quizId, location.pathname, location.state, navigate]);

      const handleActualSelectionChange = useCallback(() => {
        if (isReviewMode || !highlightButtonRef.current || !quizPageContainerRef.current) return;

        requestAnimationFrame(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                if (highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }

            const range = selection.getRangeAt(0);
            let commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE) {
                commonAncestor = commonAncestor.parentNode;
            }

            let highlightTargetElement = null;
            if (passageContainerRef.current && passageContainerRef.current.contains(commonAncestor)) {
                highlightTargetElement = passageContainerRef.current;
            } else if (commonAncestor.closest) {
                const questionCardElement = quizPageContainerRef.current.querySelector('.question-card');
                if (questionCardElement) {
                    const questionContent = commonAncestor.closest('.question-html-content');
                    const optionContent = commonAncestor.closest('.option-html-content');

                    if (questionContent && questionCardElement.contains(questionContent)) {
                        highlightTargetElement = questionContent;
                    } else if (optionContent && questionCardElement.contains(optionContent)) {
                        highlightTargetElement = optionContent;
                    }
                }
            }


            if (highlightTargetElement && range.toString().trim() !== "") {
                const rect = range.getBoundingClientRect();
                const mainContainerRect = quizPageContainerRef.current.getBoundingClientRect();

                const buttonTop = rect.top - mainContainerRect.top + quizPageContainerRef.current.scrollTop - 35;
                const buttonLeft = rect.left - mainContainerRect.left + quizPageContainerRef.current.scrollLeft + (rect.width / 2);

                highlightButtonRef.current.style.top = `${buttonTop}px`;
                highlightButtonRef.current.style.left = `${buttonLeft}px`;
                highlightButtonRef.current.style.display = 'block';
                highlightButtonRef.current._selectionRange = range.cloneRange();
            } else {
                if (highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
            }
        });
    }, [isReviewMode]);

    useEffect(() => {
        debouncedSelectionChangeHandlerRef.current = debounce(handleActualSelectionChange, 150);
    }, [handleActualSelectionChange]);


    const handleContainerClick = useCallback((event) => {
        if (isReviewMode || !quizPageContainerRef.current) { return; }
        const clickedElement = event.target;
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) { return; }

        const markElement = clickedElement.closest('mark.custom-highlight');
        if (markElement && quizPageContainerRef.current.contains(markElement)) {
            let isInValidArea = false;
            const parentPassage = markElement.closest('.passage-container');
            const parentQuestion = markElement.closest('.question-html-content');
            const parentOption = markElement.closest('.option-html-content');

            if (parentPassage && passageContainerRef.current && passageContainerRef.current.contains(markElement)) isInValidArea = true;
            else if (parentQuestion && quizPageContainerRef.current.querySelector('.question-card')?.contains(parentQuestion)) isInValidArea = true;
            else if (parentOption && quizPageContainerRef.current.querySelector('.question-card')?.contains(parentOption)) isInValidArea = true;

            if (isInValidArea) {
                const parentOfMark = markElement.parentNode;
                if (parentOfMark) {
                    while (markElement.firstChild) parentOfMark.insertBefore(markElement.firstChild, markElement);
                    parentOfMark.removeChild(markElement);
                    parentOfMark.normalize();
                }
                if (highlightButtonRef.current) {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                const selection = window.getSelection();
                if (selection) selection.removeAllRanges();
                event.stopPropagation();
                return;
            }
        }

        if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
             const selection = window.getSelection();
             if (!selection || selection.isCollapsed || selection.rangeCount === 0 || selection.toString().trim() === "") {
                highlightButtonRef.current.style.display = 'none';
                highlightButtonRef.current._selectionRange = null;
                if (selection) selection.removeAllRanges();
             }
        }
    }, [isReviewMode]);

    useEffect(() => {
        isMountedRef.current = true;
        setIsLoading(true); setError(null);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        try {
            const loadedQuizData = getQuizData(topicId, sectionType, quizId);
            const loadedQuizMetadata = getQuizMetadata(topicId, sectionType, quizId);

            if (!loadedQuizData || loadedQuizData.length === 0 || !loadedQuizMetadata) {
                throw new Error(`Quiz data or metadata not found, or quiz is empty.`);
            }
            setAllQuizQuestions(loadedQuizData);
            setQuizMetadata(loadedQuizMetadata);
            loadSavedStateAndInitialize(loadedQuizData);

        } catch (err) {
            console.error('[QuizPage] Error loading quiz data:', err);
            setError(err.message || 'Failed to load quiz.');
            setAllQuizQuestions([]); setQuizMetadata(null);
        } finally {
             if(isMountedRef.current) setIsLoading(false);
        }

        const currentDebouncedHandler = debouncedSelectionChangeHandlerRef.current;
        document.addEventListener('selectionchange', currentDebouncedHandler);

        return () => {
            isMountedRef.current = false;
            saveStateRef.current();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            document.removeEventListener('selectionchange', currentDebouncedHandler);
        };
    }, [topicId, sectionType, quizId, loadSavedStateAndInitialize]);


    useEffect(() => {
        if (allQuizQuestions && allQuizQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < allQuizQuestions.length) {
            const currentQData = allQuizQuestions[currentQuestionIndex];
            if (currentQData && !currentQData.error && currentQData.passage && currentQData.passage.html_content) {
                setPassageHtml(cleanPassageHtml(currentQData.passage.html_content));
            } else {
                setPassageHtml(null);
            }
        } else {
            setPassageHtml(null);
        }
    }, [currentQuestionIndex, allQuizQuestions]);

    const toggleHighlight = useCallback(() => {
        if (!highlightButtonRef.current || !highlightButtonRef.current._selectionRange) {
            if(highlightButtonRef.current) highlightButtonRef.current.style.display = 'none';
            return;
        }

        const range = highlightButtonRef.current._selectionRange;
        if (!range || range.collapsed || range.toString().trim() === "") {
            highlightButtonRef.current.style.display = 'none';
            highlightButtonRef.current._selectionRange = null;
            const currentSelection = window.getSelection();
            if (currentSelection) currentSelection.removeAllRanges();
            return;
        }

        const mark = document.createElement('mark');
        mark.className = 'custom-highlight';
        try {
            range.surroundContents(mark);
        } catch (e) {
            console.warn("range.surroundContents() failed. Error:", e);
        }

        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        const currentSelection = window.getSelection();
        if(currentSelection) currentSelection.removeAllRanges();

    }, []);

    useEffect(() => {
        if (isTimerActive && !isReviewMode) {
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current);
                            timerIntervalRef.current = null;
                            if (isMountedRef.current) {
                                alert("Time's up!");
                                handleFinishQuizRef.current(true);
                            }
                            return 0;
                        }
                        return newTime;
                    } else {
                        return prevTime + 1;
                    }
                });
            }, 1000);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [isTimerActive, isCountdown, isReviewMode]);


    useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (!isReviewSummaryVisible && currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex] && !tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else if (isReviewSummaryVisible || submittedAnswers[currentQuestionIndex] || tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = null;
            }
        }
        return () => {
             if (questionStartTimeRef.current && !isReviewSummaryVisible) {
                // Time captured by other handlers (submit, reveal, nav)
             }
        };
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, isReviewMode, tempReveal, isReviewSummaryVisible]);

    const toggleSolutionReveal = useCallback(() => {
        if (sectionType === 'qbank' && !isReviewMode && allQuizQuestions[currentQuestionIndex] && !allQuizQuestions[currentQuestionIndex].error) {
            const qIndex = currentQuestionIndex;
            setTempReveal(prev => {
                const newRevealStateForCurrent = !prev[qIndex];
                if (newRevealStateForCurrent && questionStartTimeRef.current) {
                    const endTime = Date.now();
                    const elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                    setUserTimeSpent(prevTS => ({ ...prevTS, [qIndex]: (prevTS[qIndex] || 0) + elapsedSeconds }));
                    questionStartTimeRef.current = null;
                }
                return {...prev, [qIndex]: newRevealStateForCurrent};
            });
            setShowExplanation(prevExp => ({
                ...prevExp,
                [qIndex]: !tempReveal[qIndex]
            }));
        }
    }, [sectionType, isReviewMode, allQuizQuestions, currentQuestionIndex, tempReveal]);

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (isReviewSummaryVisible) return;
            if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                toggleSolutionReveal();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [toggleSolutionReveal, isReviewSummaryVisible]);


    const handleOptionSelect = useCallback((questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex]) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    }, [isReviewMode, submittedAnswers, tempReveal]);

    const submitAnswerForIndex = useCallback((questionIndex) => {
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (!questionToSubmit || questionToSubmit.error) return 'error_question';
        if (isReviewMode || tempReveal[questionIndex]) return true;

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
            setTimeout(() => saveStateRef.current(), 0);
            return true;
        } else if (submittedAnswers[questionIndex]) {
            return true;
        }
        return 'no_answer_selected';
    }, [allQuizQuestions, isReviewMode, tempReveal, userAnswers, submittedAnswers, userTimeSpent]);

    const toggleExplanation = useCallback((questionIndex) => {
        const currentTempRevealForQuestion = tempReveal[questionIndex];
        const currentShowExplanationForQuestion = showExplanation[questionIndex];

        if (sectionType === 'qbank' && currentTempRevealForQuestion !== undefined) {
             setTempReveal(prev => ({...prev, [questionIndex]: !currentShowExplanationForQuestion }));
        }
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    }, [sectionType, tempReveal, showExplanation]);

    const handleToggleCrossOff = useCallback((questionIndex, optionLabel) => {
        if (!submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex]) {
            setCrossedOffOptions(prev => {
                const newCrossedOff = {...prev};
                const currentSet = newCrossedOff[questionIndex] ? new Set(newCrossedOff[questionIndex]) : new Set();
                if (currentSet.has(optionLabel)) { currentSet.delete(optionLabel); }
                else { currentSet.add(optionLabel); }
                newCrossedOff[questionIndex] = currentSet;

                if (currentSet.has(userAnswers[questionIndex])) {
                    setUserAnswers(prevUserAnswers => {
                        const updatedAnswers = { ...prevUserAnswers };
                        delete updatedAnswers[questionIndex];
                        return updatedAnswers;
                    });
                }
                return newCrossedOff;
            });
            setTimeout(() => saveStateRef.current(), 0);
        }
    }, [isReviewMode, submittedAnswers, tempReveal, userAnswers]);

    const handleToggleMark = useCallback((questionIndex) => {
        if (!isReviewMode) {
            setMarkedQuestions(prev => {
                const newState = { ...prev };
                newState[questionIndex] = !newState[questionIndex];
                return newState;
            });
            setTimeout(() => saveStateRef.current(), 0);
        }
    }, [isReviewMode]);

    const handleJumpToQuestion = useCallback((index) => {
        if (index >= 0 && index < allQuizQuestions.length) {
            if (tempReveal[currentQuestionIndex]) {
                setTempReveal(prev => ({...prev, [currentQuestionIndex]: false}));
            }
            setCurrentQuestionIndex(index);
            if (isReviewMode) {
                setShowExplanation({ [index]: true });
            } else {
                setTempReveal(prev => ({...prev, [index]: false}));
                if (!submittedAnswers[index]) {
                     setShowExplanation(prev => ({ ...prev, [index]: false }));
                } else {
                     setShowExplanation(prev => ({ ...prev, [index]: true }));
                }
            }
            setIsReviewSummaryVisible(false);
        }
     }, [allQuizQuestions, isReviewMode, tempReveal, currentQuestionIndex, submittedAnswers]);

    const handleSubmitAndNavigate = useCallback(() => {
        submitAnswerForIndex(currentQuestionIndex);
        if (tempReveal[currentQuestionIndex]) {
            setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
        }
        if (currentQuestionIndex < allQuizQuestions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            setTempReveal(prev => ({ ...prev, [nextIndex]: false }));
            if (!submittedAnswers[nextIndex] && !tempReveal[nextIndex]) {
                 setShowExplanation(prev => ({ ...prev, [nextIndex]: false }));
            } else if (submittedAnswers[nextIndex]) {
                 setShowExplanation(prev => ({ ...prev, [nextIndex]: true }));
            }
        } else {
             handleFinishQuizRef.current(false);
        }
    }, [allQuizQuestions, currentQuestionIndex, submitAnswerForIndex, tempReveal, submittedAnswers]);

    const handlePrevious = useCallback(() => {
        if (currentQuestionIndex > 0) {
            if (tempReveal[currentQuestionIndex]) {
                setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
            }
            const prevIndex = currentQuestionIndex - 1;
            setCurrentQuestionIndex(prevIndex);
            setTempReveal(prev => ({ ...prev, [prevIndex]: false }));
             if (!submittedAnswers[prevIndex] && !tempReveal[prevIndex]) {
                setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
             } else if (submittedAnswers[prevIndex]) {
                setShowExplanation(prev => ({ ...prev, [prevIndex]: true }));
             }
        }
    }, [currentQuestionIndex, tempReveal, submittedAnswers]);

    const handleOpenReviewSummary = () => {
        setCurrentQuestionIndexBeforeReview(currentQuestionIndex);
        setIsReviewSummaryVisible(true);
    };

    const handleCloseReviewSummary = () => {
        setIsReviewSummaryVisible(false);
        setCurrentQuestionIndex(currentQuestionIndexBeforeReview);
    };

    if (isLoading) return <div className="page-loading">Loading Quiz...</div>;
    if (error) return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    if (!allQuizQuestions || allQuizQuestions.length === 0) return ( <div className="page-info"> No questions found for this quiz. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );

    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    const displayAsSubmitted = !!submittedAnswers[currentQuestionIndex] || isReviewMode || !!tempReveal[currentQuestionIndex];
    const displayExplanation = !!showExplanation[currentQuestionIndex] || (isReviewMode && !currentQuestionData?.error) || !!tempReveal[currentQuestionIndex];

    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOffForCard = crossedOffOptions[currentQuestionIndex] || EMPTY_SET;
    const currentIsMarkedForCard = !!markedQuestions[currentQuestionIndex];
    const isCurrentQuestionError = !!currentQuestionData?.error;

     if (!currentQuestionData && !isReviewSummaryVisible) {
         return <div className="page-error">Error: Question data missing. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
     }

    const totalQuestionsForDisplay = quizMetadata?.totalQuestions || allQuizQuestions.length;

    // Determine the style for the main quiz page container
    // Remove bottom padding if review summary is visible, so its own fixed footer can sit at the very bottom.
    const quizPageContainerActiveStyle = {
        marginLeft: isSidebarEffectivelyPinned ? '250px' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - 250px)` : '100%',
        paddingBottom: isReviewSummaryVisible ? '0px' : '90px', // 90px is for normal quiz nav
    };

    const sharedFixedFooterStyle = {
        left: isSidebarEffectivelyPinned ? '250px' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - 250px)` : '100%',
    };

    const timerDisplayComponent = (
        <>
            {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
            <span className={isCountdown && timerValue < 60 && timerValue > 0 ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
            {isCountdown && initialDuration > 0 && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
        </>
    );

    return (
        <div
            className="quiz-page-container"
            ref={quizPageContainerRef}
            onClick={handleContainerClick}
            style={quizPageContainerActiveStyle}
        >
            {isReviewSummaryVisible ? (
                <QuizReviewSummary
                    allQuizQuestions={allQuizQuestions}
                    quizMetadata={quizMetadata}
                    markedQuestions={markedQuestions}
                    submittedAnswers={submittedAnswers}
                    userAnswers={userAnswers}
                    currentQuestionIndexBeforeReview={currentQuestionIndexBeforeReview}
                    topicId={topicId}
                    onCloseReviewSummary={handleCloseReviewSummary}
                    onJumpToQuestionInQuiz={handleJumpToQuestion}
                    onEndQuiz={() => handleFinishQuizRef.current(false)}
                    timerDisplayContent={timerDisplayComponent}
                    dynamicFooterStyle={sharedFixedFooterStyle}
                />
            ) : (
                <>
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

                    <MemoizedPassage
                        html={passageHtml}
                        passageRef={passageContainerRef}
                    />

                    <button
                        ref={highlightButtonRef}
                        className="highlight-popup-button"
                        style={{ display: 'none' }}
                        onClick={toggleHighlight}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        Highlight
                    </button>

                    <div className="quiz-controls-top">
                        {!isReviewMode && ( <div className="timer-display">{timerDisplayComponent}</div> )}
                        {isReviewMode && <div className="timer-display-placeholder"></div>}
                    </div>

                    <div className="quiz-content-area">
                        {currentQuestionData && (
                             <QuestionCard
                                questionData={currentQuestionData}
                                questionIndex={currentQuestionIndex}
                                selectedOption={userAnswers[currentQuestionIndex]}
                                isSubmitted={displayAsSubmitted}
                                showExplanation={displayExplanation}
                                crossedOffOptions={currentCrossedOffForCard}
                                userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]}
                                isReviewMode={isReviewMode}
                                isMarked={currentIsMarkedForCard}
                                onOptionSelect={handleOptionSelect}
                                onViewAnswer={toggleSolutionReveal}
                                onToggleExplanation={toggleExplanation}
                                onToggleCrossOff={handleToggleCrossOff}
                                onToggleMark={handleToggleMark}
                                isTemporarilyRevealed={!!tempReveal[currentQuestionIndex]}
                            />
                        )}
                    </div>

                    <div className="quiz-navigation" style={sharedFixedFooterStyle}>
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
                                <button onClick={() => handleFinishQuizRef.current(false)} className="nav-button submit-quiz-button">
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
                                    className={`mark-button-nav ${currentIsMarkedForCard ? 'marked' : ''}`}
                                    title={currentIsMarkedForCard ? "Unmark this question" : "Mark for review"}
                                >
                                {currentIsMarkedForCard ? '🚩 Unmark' : '🏳️ Mark'}
                                </button>
                            )}
                            {isReviewMode && <div className="mark-button-nav-placeholder"></div>}


                            {!isReviewMode && (
                                <button onClick={handleOpenReviewSummary} className="nav-button review-button-bottom">
                                    Review
                                </button>
                            )}
                            {isReviewMode && <div className="review-button-bottom-placeholder"></div>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default QuizPage;