// FILE: client/src/pages/QuizPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../data/loader';
import QuestionCard from '../components/QuestionCard';
import QuizReviewSummary from '../components/QuizReviewSummary';
import PracticeTestOptions from '../components/PracticeTestOptions';
import { useLayout } from '../context/LayoutContext';
import '../styles/QuizPage.css';

// --- Utility Functions (debounce, cleanPassageHtml, PRACTICE_TEST_DURATIONS, formatTime) ---
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
    
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0);

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

    const [isPracticeOptionsModalOpen, setIsPracticeOptionsModalOpen] = useState(false);
    const [practiceTestSettings, setPracticeTestSettings] = useState({ prometricDelay: false, additionalTime: false });
    const [hasPracticeTestStarted, setHasPracticeTestStarted] = useState(false); 
    const [isNavActionInProgress, setIsNavActionInProgress] = useState(false);

    const latestStateRef = useRef({});
    useEffect(() => {
        latestStateRef.current = {
            isReviewMode,
            hasPracticeTestStarted,
            isPracticeOptionsModalOpen,
            isNavActionInProgress,
        };
    }, [isReviewMode, hasPracticeTestStarted, isPracticeOptionsModalOpen, isNavActionInProgress]);


    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    const saveState = useCallback(() => {
        if (latestStateRef.current.isReviewMode || !isMountedRef.current || (sectionType === 'practice' && !latestStateRef.current.hasPracticeTestStarted)) {
            return;
        }
        const stateToSave = {
            currentQuestionIndex, userAnswers, submittedAnswers, userTimeSpent,
            timerValue, isCountdown, initialDuration, markedQuestions, tempReveal, showExplanation,
            isReviewSummaryVisible, currentQuestionIndexBeforeReview,
            hasPracticeTestStarted: latestStateRef.current.hasPracticeTestStarted, 
            practiceTestSettings,
            crossedOffOptions: Object.fromEntries(
                Object.entries(crossedOffOptions).map(([key, valueSet]) => [
                    key, Array.from(valueSet instanceof Set ? valueSet : new Set())
                ])
            ),
        };
        try { localStorage.setItem(getQuizStateKey(), JSON.stringify(stateToSave)); }
        catch (e) { console.error("[QuizPage] Error saving state:", e); }
    }, [ 
        getQuizStateKey, currentQuestionIndex, userAnswers, submittedAnswers,
        userTimeSpent, timerValue, isCountdown, initialDuration, markedQuestions, tempReveal,
        showExplanation, crossedOffOptions, isReviewSummaryVisible, currentQuestionIndexBeforeReview,
        practiceTestSettings, sectionType
    ]);
    const saveStateRef = useRef(saveState);
    useEffect(() => { saveStateRef.current = saveState; }, [saveState]);


    const handleFinishQuiz = useCallback((timedOut = false) => {
        if (!isMountedRef.current || (sectionType === 'practice' && !latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isReviewMode)) { 
            return;
        }
        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (latestStateRef.current.isReviewMode) {
            navigate(`/results/${topicId}/${sectionType}/${quizId}`);
            return;
        }
        let score = 0;
        let correctIndices = [];
        let incorrectIndices = [];
        if (!allQuizQuestions || allQuizQuestions.length === 0 || !quizMetadata) {
            setError("Could not finalize quiz due to missing data.");
            if(isMountedRef.current) setIsLoading(false);
            return;
        }
        const totalPossibleScore = allQuizQuestions.length;
        const totalValidQuestions = allQuizQuestions.filter(q => q && !q.error).length;
        allQuizQuestions.forEach((q, index) => {
            if (!q || q.error) return;
            const userAnswerLabel = userAnswers[index];
            const isAnswerSubmittedByState = submittedAnswers[index]; 
            const correctOption = q.options?.find(opt => opt.is_correct === true);
            const correctAnswerLabel = correctOption?.label;
            if (isAnswerSubmittedByState) { 
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
            timestamp: Date.now(), 
            quizName: quizMetadata?.fullNameForDisplay || quizMetadata?.name || 'Quiz', 
            topicName: quizMetadata?.topicName || formatDisplayName(topicId), 
            practiceTestSettings 
        };
        localStorage.setItem(`quizResults-${topicId}-${sectionType}-${quizId}`, JSON.stringify(results));
        localStorage.removeItem(getQuizStateKey());
        setIsReviewSummaryVisible(false);
        if(isMountedRef.current) setIsLoading(false);
        navigate(`/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    }, [allQuizQuestions, quizMetadata, navigate, sectionType, topicId, quizId, userAnswers, submittedAnswers, userTimeSpent, markedQuestions, practiceTestSettings, getQuizStateKey, setError]);
    const handleFinishQuizRef = useRef(handleFinishQuiz);
    useEffect(() => { handleFinishQuizRef.current = handleFinishQuiz; }, [handleFinishQuiz]);

    const initializeNewQuizState = useCallback((ptSettings) => {
        setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
        setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
        setMarkedQuestions({}); setTempReveal({}); setIsReviewSummaryVisible(false); setCurrentQuestionIndexBeforeReview(0);
        if (sectionType === 'practice') {
            if (!quizMetadata) { 
                setError("Failed to initialize practice test: essential data missing for timing.");
                return; 
            }
            const topicKeyForDuration = quizMetadata.topicName?.toLowerCase().replace(/\s+/g, '-') || topicId.toLowerCase().replace(/\s+/g, '-');
            let duration = PRACTICE_TEST_DURATIONS[topicKeyForDuration] || PRACTICE_TEST_DURATIONS.default;
            if (ptSettings?.additionalTime) {
                duration = Math.round(duration * 1.5);
            }
            setTimerValue(duration); setInitialDuration(duration);
            setIsCountdown(true); setIsTimerActive(true); 
            setHasPracticeTestStarted(true); 
        } else { 
            setTimerValue(0); setIsCountdown(false); setIsTimerActive(true); 
            setInitialDuration(0);
            setHasPracticeTestStarted(true); 
        }
    }, [topicId, sectionType, quizMetadata, quizId]);


    // Effect 1: Route changes, core data fetching, and initial state reset
    useEffect(() => {
        isMountedRef.current = true;
        setIsLoading(true); 
        setError(null);
        setAllQuizQuestions([]); setQuizMetadata(null);
        setHasPracticeTestStarted(false); setIsPracticeOptionsModalOpen(false);
        setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({}); setShowExplanation({});
        setCrossedOffOptions({}); setUserTimeSpent({}); setMarkedQuestions({});
        setTempReveal({}); setIsReviewSummaryVisible(false);
        setTimerValue(0); setIsTimerActive(false); 
        setPracticeTestSettings({ prometricDelay: false, additionalTime: false });
        setIsNavActionInProgress(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const currentReviewStatus = location.state?.review || false;
        const currentReviewIdx = location.state?.questionIndex ?? 0;
        setIsReviewMode(currentReviewStatus);
        setReviewQuestionIndex(currentReviewIdx);

        try {
            const loadedQuizData = getQuizData(topicId, sectionType, quizId);
            const loadedQuizMetadata = getQuizMetadata(topicId, sectionType, quizId);
            if (!loadedQuizData || loadedQuizData.length === 0 || !loadedQuizMetadata) {
                throw new Error(`Essential quiz data or metadata not found.`);
            }
            if (isMountedRef.current) {
                setAllQuizQuestions(loadedQuizData);
                setQuizMetadata(loadedQuizMetadata);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message);
                setIsLoading(false);
            }
        }
        return () => {
            isMountedRef.current = false;
            saveStateRef.current();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [topicId, sectionType, quizId, location.state?.review, location.state?.questionIndex]);


    // Effect 2: Handles logic after core data is loaded
    useEffect(() => {
        if (!quizMetadata || !allQuizQuestions || allQuizQuestions.length === 0) {
            if (error && isMountedRef.current) setIsLoading(false); 
            return; 
        }
        if (isReviewMode) { 
            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResults = localStorage.getItem(resultsKey);
            if (savedResults) {
                try {
                    const parsedResults = JSON.parse(savedResults);
                    setUserAnswers(parsedResults.userAnswers || {});
                    setMarkedQuestions(parsedResults.markedQuestions || {});
                    const allSubmitted = {};
                    allQuizQuestions.forEach((_, index) => { allSubmitted[index] = true; });
                    setSubmittedAnswers(allSubmitted);
                    setCurrentQuestionIndex(reviewQuestionIndex);
                    setShowExplanation({ [reviewQuestionIndex]: true }); 
                    setPracticeTestSettings(parsedResults.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                } catch (e) { console.error("Error parsing results for review:", e); }
            }
            setHasPracticeTestStarted(true); 
            setIsPracticeOptionsModalOpen(false);
            setIsTimerActive(false); setTimerValue(0); setIsCountdown(false);
            setTempReveal({});
        } else { 
            const savedStateString = localStorage.getItem(getQuizStateKey());
            if (savedStateString) {
                try {
                    const savedState = JSON.parse(savedStateString);
                    setPracticeTestSettings(savedState.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                    if (sectionType === 'practice' && !savedState.hasPracticeTestStarted) {
                        setIsPracticeOptionsModalOpen(true); setHasPracticeTestStarted(false);
                    } else {
                        setHasPracticeTestStarted(savedState.hasPracticeTestStarted || (sectionType !== 'practice'));
                        setCurrentQuestionIndex(savedState.currentQuestionIndex || 0);
                        setUserAnswers(savedState.userAnswers || {});
                        setSubmittedAnswers(savedState.submittedAnswers || {});
                        const loadedCrossed = {};
                        for (const qIdx in savedState.crossedOffOptions) {
                            if (Array.isArray(savedState.crossedOffOptions[qIdx])) {
                                loadedCrossed[qIdx] = new Set(savedState.crossedOffOptions[qIdx]);
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
                        setIsReviewSummaryVisible(savedState.isReviewSummaryVisible || false);
                        setCurrentQuestionIndexBeforeReview(savedState.currentQuestionIndexBeforeReview || 0);
                        if (!(savedState.isCountdown && savedState.timerValue <= 0) && (savedState.hasPracticeTestStarted || sectionType !== 'practice')) {
                            setIsTimerActive(true);
                        } else { setIsTimerActive(false); }
                        setIsPracticeOptionsModalOpen(false); 
                    }
                } catch (e) {
                    localStorage.removeItem(getQuizStateKey());
                    if (sectionType === 'practice') {
                        setIsPracticeOptionsModalOpen(true); setHasPracticeTestStarted(false);
                    } else {
                        initializeNewQuizState(null); setIsPracticeOptionsModalOpen(false);
                    }
                }
            } else { 
                if (sectionType === 'practice') {
                    setIsPracticeOptionsModalOpen(true); setHasPracticeTestStarted(false);
                } else { 
                    initializeNewQuizState(null); setIsPracticeOptionsModalOpen(false);
                }
            }
        }
        if (isMountedRef.current) setIsLoading(false);
    }, [quizMetadata, allQuizQuestions, isReviewMode, reviewQuestionIndex, getQuizStateKey, sectionType, initializeNewQuizState, topicId, quizId, error]);


    const handlePracticeTestOptionsClose = useCallback(() => {
        setIsPracticeOptionsModalOpen(false);
        if (!hasPracticeTestStarted) { 
            if (isMountedRef.current) setIsLoading(false); 
            navigate(`/topic/${topicId}`);
        }
    }, [navigate, topicId, hasPracticeTestStarted]); 

    const handleStartPracticeTest = useCallback((settings) => {
        setPracticeTestSettings(settings); 
        setIsPracticeOptionsModalOpen(false); 
        initializeNewQuizState(settings); 
    }, [initializeNewQuizState]); 

    useEffect(() => {
        if (allQuizQuestions && allQuizQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < allQuizQuestions.length) {
            const currentQData = allQuizQuestions[currentQuestionIndex];
            if (currentQData && !currentQData.error && currentQData.passage && currentQData.passage.html_content) {
                setPassageHtml(cleanPassageHtml(currentQData.passage.html_content));
            } else { setPassageHtml(null); }
        } else { setPassageHtml(null); }
    }, [currentQuestionIndex, allQuizQuestions]);

    // --- Highlighting Logic ---
    const toggleHighlight = useCallback(() => {
        if (latestStateRef.current.isReviewMode || !highlightButtonRef.current || !highlightButtonRef.current._selectionRange) {
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
            console.warn("[HL] toggleHighlight: range.surroundContents() failed. Error:", e);
        }
        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        const currentSelection = window.getSelection();
        if(currentSelection) currentSelection.removeAllRanges(); 
    }, []); 

    const handleActualSelectionChange = useCallback(() => {
        const { 
            isReviewMode: currentIsReviewMode,
            hasPracticeTestStarted: currentHasPracticeTestStarted,
            isPracticeOptionsModalOpen: currentIsPracticeOptionsModalOpen,
            isNavActionInProgress: currentIsNavActionInProgress,
        } = latestStateRef.current;

        if (currentIsReviewMode || !currentHasPracticeTestStarted || currentIsPracticeOptionsModalOpen || currentIsNavActionInProgress || !highlightButtonRef.current || !quizPageContainerRef.current ) {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
            }
            return;
        }

        requestAnimationFrame(() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                if (highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }
            const range = selection.getRangeAt(0);
            if (selection.isCollapsed || range.toString().trim() === "") {
                 if (highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }
            let commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE) {
                commonAncestor = commonAncestor.parentNode;
            }
            let highlightTargetElement = null;
            const questionCardElement = quizPageContainerRef.current.querySelector('.question-card');
            if (passageContainerRef.current && passageContainerRef.current.contains(commonAncestor)) {
                highlightTargetElement = passageContainerRef.current;
            } else if (questionCardElement) {
                const questionContentElement = commonAncestor.closest('.question-html-content');
                const optionContentElement = commonAncestor.closest('.option-html-content');
                if (questionContentElement && questionCardElement.contains(questionContentElement)) {
                    highlightTargetElement = questionContentElement;
                } else if (optionContentElement && questionCardElement.contains(optionContentElement)) {
                    highlightTargetElement = optionContentElement;
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
    }, []); 
    
    useEffect(() => { 
        debouncedSelectionChangeHandlerRef.current = debounce(handleActualSelectionChange, 150);
        const currentDebouncedHandler = debouncedSelectionChangeHandlerRef.current; 
        if (currentDebouncedHandler) {
            document.addEventListener('selectionchange', currentDebouncedHandler);
        }
        return () => {
            if (currentDebouncedHandler) {
                document.removeEventListener('selectionchange', currentDebouncedHandler);
            }
        };
    }, [handleActualSelectionChange]);


    const handleContainerClick = useCallback((event) => {
        const { 
            isReviewMode: currentIsReviewMode,
            hasPracticeTestStarted: currentHasPracticeTestStarted,
            isPracticeOptionsModalOpen: currentIsPracticeOptionsModalOpen,
            isNavActionInProgress: currentIsNavActionInProgress,
        } = latestStateRef.current;

        if (currentIsReviewMode || !currentHasPracticeTestStarted || currentIsPracticeOptionsModalOpen || currentIsNavActionInProgress || !quizPageContainerRef.current) {
            return;
        }
        const clickedElement = event.target;
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) {
            return; 
        }
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
    }, []); 
    // --- End Highlighting Logic ---


    useEffect(() => {
        if (isTimerActive && !latestStateRef.current.isReviewMode && latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isNavActionInProgress) {
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
                    } else { return prevTime + 1; }
                });
            }, 1000);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => { 
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); 
        };
    }, [isTimerActive, isCountdown, handleFinishQuizRef]); 


    useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !latestStateRef.current.isReviewMode && latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isNavActionInProgress) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (!isReviewSummaryVisible && currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex] && !tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else if (isReviewSummaryVisible || submittedAnswers[currentQuestionIndex] || tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = null;
            }
        }
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, tempReveal, isReviewSummaryVisible]);

    const toggleSolutionReveal = useCallback(() => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return; 
        if (sectionType === 'qbank' && !latestStateRef.current.isReviewMode && allQuizQuestions.length > 0 && allQuizQuestions[currentQuestionIndex] && !allQuizQuestions[currentQuestionIndex].error ) {
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
    }, [sectionType, allQuizQuestions, currentQuestionIndex, tempReveal]);

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (!latestStateRef.current.hasPracticeTestStarted || isReviewSummaryVisible || latestStateRef.current.isPracticeOptionsModalOpen || latestStateRef.current.isNavActionInProgress) return; 
            if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                toggleSolutionReveal();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => { window.removeEventListener('keydown', handleKeyPress); };
    }, [toggleSolutionReveal, isReviewSummaryVisible]);

    const handleOptionSelect = useCallback((questionIndex, optionLabel) => { 
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return; 
        const isPracticeTestActive = sectionType === 'practice' && !latestStateRef.current.isReviewMode;
        
        let canSelectOption = false;
        if (isPracticeTestActive) {
            canSelectOption = !crossedOffOptions[questionIndex]?.has(optionLabel);
        } else { 
            canSelectOption = !submittedAnswers[questionIndex] && !latestStateRef.current.isReviewMode && !tempReveal[questionIndex] && !crossedOffOptions[questionIndex]?.has(optionLabel);
        }

        if (canSelectOption) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    }, [sectionType, submittedAnswers, tempReveal, crossedOffOptions]);

    const submitAnswerForIndex = useCallback((questionIndex) => { 
        if (!latestStateRef.current.hasPracticeTestStarted) return 'test_not_started'; 
        if (!allQuizQuestions[questionIndex]) return 'error_question'; 
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (questionToSubmit.error) return 'error_question';
        
        if (latestStateRef.current.isReviewMode || (sectionType === 'qbank' && tempReveal[questionIndex])) return true; 

        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex]) {
            let elapsedSeconds = userTimeSpent[questionIndex] !== undefined ? userTimeSpent[questionIndex] : 0;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                questionStartTimeRef.current = null; 
            }
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            
            if (sectionType === 'qbank' && !latestStateRef.current.isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: true })); 
            } else if (sectionType === 'practice' && !latestStateRef.current.isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: false })); 
            }

            setTimeout(() => saveStateRef.current(), 0); 
            return true;
        } else if (submittedAnswers[questionIndex]) {
            return true; 
        }
        return 'no_answer_selected';  
    }, [allQuizQuestions, tempReveal, userAnswers, submittedAnswers, userTimeSpent, sectionType]);

    const toggleExplanation = useCallback((questionIndex) => { 
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return; 
        if (!allQuizQuestions[questionIndex]) return; 
        
        if (sectionType === 'practice' && !latestStateRef.current.isReviewMode && !tempReveal[questionIndex]) return;

        const currentTempRevealForQuestion = tempReveal[questionIndex];
        const currentShowExplanationForQuestion = showExplanation[questionIndex];

        if (sectionType === 'qbank' && !latestStateRef.current.isReviewMode && currentTempRevealForQuestion !== undefined) {
             setTempReveal(prev => ({...prev, [questionIndex]: !currentShowExplanationForQuestion }));
        }
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    }, [sectionType, tempReveal, showExplanation, allQuizQuestions]);

    const handleToggleCrossOff = useCallback((questionIndex, optionLabel) => { 
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return; 
        const isPracticeTestActive = sectionType === 'practice' && !latestStateRef.current.isReviewMode;
        const canToggle = isPracticeTestActive || (!submittedAnswers[questionIndex] && !latestStateRef.current.isReviewMode && !tempReveal[questionIndex]);

        if (canToggle ) {
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
    }, [sectionType, submittedAnswers, tempReveal, userAnswers]);

    const handleToggleMark = useCallback((questionIndex) => { 
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isReviewMode ) return; 
        setMarkedQuestions(prev => {
            const newState = { ...prev };
            newState[questionIndex] = !newState[questionIndex];
            return newState;
        });
        setTimeout(() => saveStateRef.current(), 0);
    }, []); 

    const executeWithDelay = useCallback((actionFn, isNonNavFooterAction = false) => {
        if (!latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isReviewMode) { 
            if(!latestStateRef.current.isReviewMode && !isNonNavFooterAction) { 
                return;
            }
        }
        if (latestStateRef.current.isNavActionInProgress && !isNonNavFooterAction) { 
            return;
        }
        const prometricShouldApply = (sectionType === 'practice' || latestStateRef.current.isReviewMode) && practiceTestSettings.prometricDelay;
        if (prometricShouldApply) { 
            setIsNavActionInProgress(true);
            setTimeout(() => {
                actionFn();
                if(isMountedRef.current) setIsNavActionInProgress(false);
            }, 2000);
        } else {
            actionFn(); 
        }
    }, [sectionType, practiceTestSettings.prometricDelay]);


    const handleJumpToQuestion = useCallback((index, fromSummaryTable = false) => { 
        if (!latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isReviewMode) return; 
        const jumpAction = () => { 
            if (index >= 0 && index < allQuizQuestions.length) {
                 if (tempReveal[currentQuestionIndex] && !latestStateRef.current.isReviewMode) { 
                    setTempReveal(prev => ({...prev, [currentQuestionIndex]: false}));
                }
                setCurrentQuestionIndex(index);
                if (latestStateRef.current.isReviewMode) { 
                    setShowExplanation({ [index]: true }); 
                } else {
                    setTempReveal(prev => ({...prev, [index]: false}));
                    if (sectionType === 'practice') { 
                        setShowExplanation(prev => ({ ...prev, [index]: false }));
                    } else if (submittedAnswers[index]) { 
                         setShowExplanation(prev => ({ ...prev, [index]: true })); 
                    } else { 
                         setShowExplanation(prev => ({ ...prev, [index]: false }));
                    }
                }
                setIsReviewSummaryVisible(false); 
            }
         };
        if (fromSummaryTable) { 
            jumpAction();
        } else { 
            executeWithDelay(jumpAction, false); 
        }
     }, [allQuizQuestions, tempReveal, currentQuestionIndex, submittedAnswers, executeWithDelay, sectionType, isReviewSummaryVisible]);

    const handleSubmitAndNavigate = useCallback(() => { 
        if (!latestStateRef.current.hasPracticeTestStarted) return; 
        const submissionResult = submitAnswerForIndex(currentQuestionIndex);
        const navigateAction = () => { 
            if (tempReveal[currentQuestionIndex] && !latestStateRef.current.isReviewMode) {
                setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
            }
            if (currentQuestionIndex < allQuizQuestions.length - 1) {
                const nextIndex = currentQuestionIndex + 1;
                setCurrentQuestionIndex(nextIndex);
                setTempReveal(prev => ({ ...prev, [nextIndex]: false })); 
                if (sectionType === 'practice' && !latestStateRef.current.isReviewMode) {
                    setShowExplanation(prev => ({ ...prev, [nextIndex]: false }));
                } else if (submittedAnswers[nextIndex]) { 
                     setShowExplanation(prev => ({ ...prev, [nextIndex]: true })); 
                } else { 
                     setShowExplanation(prev => ({ ...prev, [nextIndex]: false }));
                }
            } else {
                 handleFinishQuizRef.current(false); 
            }
         };
        if (submissionResult !== 'error_question' && submissionResult !== 'test_not_started') {
             executeWithDelay(navigateAction, false);
        } else if (submissionResult === 'error_question') { 
            executeWithDelay(navigateAction, false);
        }
    }, [allQuizQuestions, currentQuestionIndex, submitAnswerForIndex, tempReveal, submittedAnswers, executeWithDelay, sectionType]);

    const handlePrevious = useCallback(() => { 
        if (!latestStateRef.current.hasPracticeTestStarted) return; 
        const navigateAction = () => { 
            if (currentQuestionIndex > 0) {
                if (tempReveal[currentQuestionIndex] && !latestStateRef.current.isReviewMode) {
                    setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
                }
                const prevIndex = currentQuestionIndex - 1;
                setCurrentQuestionIndex(prevIndex);
                setTempReveal(prev => ({ ...prev, [prevIndex]: false }));
                if (sectionType === 'practice' && !latestStateRef.current.isReviewMode) {
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                } else if (submittedAnswers[prevIndex]) { 
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: true }));
                } else { 
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                }
            }
         };
        executeWithDelay(navigateAction, false);
    }, [currentQuestionIndex, tempReveal, submittedAnswers, executeWithDelay, sectionType]);
    
    const handleOpenReviewSummary = useCallback(() => { 
        if (!latestStateRef.current.hasPracticeTestStarted) return;
        executeWithDelay(() => { 
            setIsReviewSummaryVisible(true); 
            setCurrentQuestionIndexBeforeReview(currentQuestionIndex);
        }, false); 
    }, [currentQuestionIndex, executeWithDelay]);

    const handleCloseReviewSummary = useCallback(() => { 
        setIsReviewSummaryVisible(false);
    },[]);


    // --- Render Logic ---
    const quizPageContainerActiveStyle = {
        marginLeft: isSidebarEffectivelyPinned ? '250px' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - 250px)` : '100%',
        paddingBottom: isReviewSummaryVisible ? '0px' : '90px',
    };

    const sharedFixedFooterStyle = {
        left: isSidebarEffectivelyPinned ? '250px' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - 250px)` : '100%',
    };
    
    const timerDisplayComponent = (
        <>
            {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
            <span className={isCountdown && timerValue < 60 && timerValue > 0 && timerValue !== initialDuration ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
            {isCountdown && initialDuration > 0 && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
        </>
    );


    if (isLoading) {
        return <div className="page-loading">Loading Quiz...</div>;
    }

    if (error) {
        return ( <div className="page-error"> Error: {error} <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div> );
    }

    if (isPracticeOptionsModalOpen && sectionType === 'practice' && !isReviewMode) { 
        if (!quizMetadata) { 
            return <div className="page-loading">Preparing Test Options... (Waiting for metadata)</div>;
        }
        const topicKeyForDuration = quizMetadata.topicName?.toLowerCase().replace(/\s+/g, '-') || topicId.toLowerCase().replace(/\s+/g, '-');
        const baseTime = PRACTICE_TEST_DURATIONS[topicKeyForDuration] || PRACTICE_TEST_DURATIONS.default;
        
        return (
            <PracticeTestOptions
                isOpen={isPracticeOptionsModalOpen}
                onClose={handlePracticeTestOptionsClose}
                onStartTest={handleStartPracticeTest}
                fullNameForDisplay={quizMetadata.fullNameForDisplay}
                categoryForInstructions={quizMetadata.categoryForInstructions}
                baseTimeLimitMinutes={Math.floor(baseTime / 60)}
                numQuestions={quizMetadata.totalQuestions}
            />
        );
    }
    
    if (sectionType === 'practice' && !hasPracticeTestStarted && !isPracticeOptionsModalOpen && !isReviewMode) { 
        return <div className="page-loading">Preparing Practice Test...</div>;
    }
    
    if ((hasPracticeTestStarted || isReviewMode) && (!allQuizQuestions || allQuizQuestions.length === 0)) { 
         return <div className="page-info"> No questions found for this quiz. Please check data files. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
    }

    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    if (!isReviewSummaryVisible && (hasPracticeTestStarted || isReviewMode) && !currentQuestionData && allQuizQuestions.length > 0) { 
         return <div className="page-error">Error: Could not load current question data. <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>;
    }

    const isPracticeTestActive = sectionType === 'practice' && !isReviewMode && hasPracticeTestStarted; 

    const cardIsSubmittedState = 
        (isPracticeTestActive && !!submittedAnswers[currentQuestionIndex]) || 
        (!isPracticeTestActive && (!!submittedAnswers[currentQuestionIndex] || isReviewMode || !!tempReveal[currentQuestionIndex])); 

    const explanationButtonShouldBeVisible = 
        !!currentQuestionData?.explanation?.html_content &&
        (isReviewMode || !!tempReveal[currentQuestionIndex] || (sectionType === 'qbank' && submittedAnswers[currentQuestionIndex])); 

    const explanationContentShouldBeExpanded = showExplanation[currentQuestionIndex] && explanationButtonShouldBeVisible;

    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOffForCard = crossedOffOptions[currentQuestionIndex] || EMPTY_SET;
    const currentIsMarkedForCard = !!markedQuestions[currentQuestionIndex];
    const isCurrentQuestionError = !!(currentQuestionData && currentQuestionData.error); 
    const totalQuestionsForDisplay = quizMetadata?.totalQuestions || allQuizQuestions.length;


    return (
        <div
            className="quiz-page-container"
            ref={quizPageContainerRef}
            onClick={handleContainerClick} 
            style={quizPageContainerActiveStyle}
        >
            <button 
                ref={highlightButtonRef} 
                className="highlight-popup-button" 
                style={{ display: 'none' }} 
                onClick={toggleHighlight} 
                onMouseDown={(e) => e.preventDefault()}
            > Highlight </button>

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
                    onEndQuiz={() => executeWithDelay(() => handleFinishQuizRef.current(false), false)} 
                    timerDisplayContent={timerDisplayComponent}
                    dynamicFooterStyle={sharedFixedFooterStyle}
                    isNavActionInProgress={isNavActionInProgress} 
                    executeActionWithDelay={executeWithDelay} 
                />
            ) : (
                <>
                    <div className="quiz-header">
                        <button 
                            onClick={() => isReviewMode ? navigate(`/results/${topicId}/${sectionType}/${quizId}`) : navigate(`/topic/${topicId}`)}  
                            className="back-button-quiz"
                            disabled={isNavActionInProgress}
                        >
                            {isReviewMode ? `\u21A9 Back to Results` : `\u21A9 Back to ${quizMetadata?.topicName || formatDisplayName(topicId)}`}
                        </button>
                        <div className="quiz-title-container">
                            <h1 className="quiz-title">{quizMetadata?.fullNameForDisplay || 'Quiz'}</h1>
                        </div>
                        <p className="quiz-progress">
                            Question {currentQuestionIndex + 1} of {totalQuestionsForDisplay}
                        </p>
                    </div>
                    
                    {/* Render passage above question card if it exists AND it's NOT reading comprehension (topicId based) */}
                    {passageHtml && topicId !== 'reading-comprehension' && (
                         <MemoizedPassage html={passageHtml} passageRef={passageContainerRef} />
                    )}
                    
                    <div className="quiz-controls-top">
                        {(!isReviewMode && hasPracticeTestStarted) && ( <div className="timer-display">{timerDisplayComponent}</div> )}
                        {(isReviewMode || !hasPracticeTestStarted) && <div className="timer-display-placeholder"></div>}
                    </div>

                    <div className="quiz-content-area">
                        {currentQuestionData && ( 
                             <QuestionCard
                                questionData={currentQuestionData}
                                questionIndex={currentQuestionIndex}
                                selectedOption={userAnswers[currentQuestionIndex]}
                                isSubmitted={cardIsSubmittedState} 
                                showExplanation={explanationContentShouldBeExpanded} 
                                crossedOffOptions={currentCrossedOffForCard}
                                userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]}
                                isReviewMode={isReviewMode} 
                                isMarked={currentIsMarkedForCard}
                                onOptionSelect={handleOptionSelect}
                                onToggleExplanation={toggleExplanation} 
                                onToggleCrossOff={handleToggleCrossOff}
                                onToggleMark={handleToggleMark}
                                isTemporarilyRevealed={!!tempReveal[currentQuestionIndex]}
                                isPracticeTestActive={isPracticeTestActive}
                            />
                        )}
                    </div>

                    {/* Render passage below question card if it exists AND it IS reading comprehension (topicId based) */}
                    {passageHtml && topicId === 'reading-comprehension' && (
                        <div className="passage-wrapper-below" style={{ marginTop: '20px' }}>
                             <MemoizedPassage html={passageHtml} passageRef={passageContainerRef} />
                        </div>
                    )}


                    <div className="quiz-navigation" style={sharedFixedFooterStyle}>
                        <div className="nav-group-left">
                            <button
                                onClick={handlePrevious}
                                disabled={!hasPracticeTestStarted || currentQuestionIndex === 0 || isNavActionInProgress} 
                                className="nav-button prev-button"
                            > Previous </button>

                            {sectionType === 'qbank' && !isReviewMode && !isCurrentQuestionError && hasPracticeTestStarted && ( 
                                <button 
                                    onClick={toggleSolutionReveal} 
                                    disabled={isNavActionInProgress}  
                                    className="nav-button solution-toggle-button-bottom">
                                    {tempReveal[currentQuestionIndex] ? "Hide Solution" : "'S' Solution"}
                                </button>
                            )}
                        </div>

                        <div className="nav-group-center">
                            {(isLastQuestion || (isReviewMode && isLastQuestion) ) ? ( 
                                <button 
                                    onClick={() => executeWithDelay(() => handleFinishQuizRef.current(false), false)} 
                                    className="nav-button submit-quiz-button"
                                    disabled={!hasPracticeTestStarted || isNavActionInProgress} 
                                >
                                    {isReviewMode ? 'Back to Results' : 'Finish Quiz'} 
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmitAndNavigate} 
                                    className="nav-button next-button"
                                    disabled={!hasPracticeTestStarted || isCurrentQuestionError || isNavActionInProgress} 
                                > Next </button>
                            )}
                        </div>

                        <div className="nav-group-right">
                            {!isReviewMode && !isCurrentQuestionError && hasPracticeTestStarted && ( 
                                <button
                                    onClick={() => executeWithDelay(() => handleToggleMark(currentQuestionIndex), false)} 
                                    disabled={isNavActionInProgress}  
                                    className={`mark-button-nav ${currentIsMarkedForCard ? 'marked' : ''}`}
                                    title={currentIsMarkedForCard ? "Unmark this question" : "Mark for review"}
                                >
                                {currentIsMarkedForCard ? '🚩 Unmark' : '🏳️ Mark'}
                                </button>
                            )}
                            {(!hasPracticeTestStarted || isReviewMode || isCurrentQuestionError) && <div className="mark-button-nav-placeholder"></div>}


                            {!isReviewMode && hasPracticeTestStarted && ( 
                                <button 
                                    onClick={handleOpenReviewSummary} 
                                    disabled={isNavActionInProgress} 
                                    className="nav-button review-button-bottom"
                                >
                                    Review
                                </button>
                            )}
                            {(!hasPracticeTestStarted || isReviewMode) && <div className="review-button-bottom-placeholder"></div>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default QuizPage;