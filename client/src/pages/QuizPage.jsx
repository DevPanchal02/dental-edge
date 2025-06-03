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

    // console.log(`[QuizPage TOP RENDER - ${quizId}] isLoading: ${isLoading}, ModalOpen: ${isPracticeOptionsModalOpen}, PTStarted: ${hasPracticeTestStarted}, Review: ${isReviewMode}, NavDelay: ${isNavActionInProgress}`);

    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    const saveState = useCallback(() => {
        if (isReviewMode || !isMountedRef.current || (sectionType === 'practice' && !hasPracticeTestStarted)) {
            return;
        }
        const stateToSave = {
            currentQuestionIndex, userAnswers, submittedAnswers, userTimeSpent,
            timerValue, isCountdown, initialDuration, markedQuestions, tempReveal, showExplanation,
            isReviewSummaryVisible, currentQuestionIndexBeforeReview,
            hasPracticeTestStarted, practiceTestSettings,
            crossedOffOptions: Object.fromEntries(
                Object.entries(crossedOffOptions).map(([key, valueSet]) => [
                    key, Array.from(valueSet instanceof Set ? valueSet : new Set())
                ])
            ),
        };
        try { localStorage.setItem(getQuizStateKey(), JSON.stringify(stateToSave)); }
        catch (e) { console.error("[QuizPage] Error saving state:", e); }
    }, [
        getQuizStateKey, isReviewMode, currentQuestionIndex, userAnswers, submittedAnswers,
        userTimeSpent, timerValue, isCountdown, initialDuration, markedQuestions, tempReveal,
        showExplanation, crossedOffOptions, isReviewSummaryVisible, currentQuestionIndexBeforeReview,
        hasPracticeTestStarted, practiceTestSettings, sectionType
    ]);
    const saveStateRef = useRef(saveState);
    useEffect(() => { saveStateRef.current = saveState; }, [saveState]);


    const handleFinishQuiz = useCallback((timedOut = false) => {
        // console.log(`[QuizPage FINISH_QUIZ - ${quizId}] Timed out: ${timedOut}, PTStarted: ${hasPracticeTestStarted}`);
        if (!isMountedRef.current || (sectionType === 'practice' && !hasPracticeTestStarted && !isReviewMode)) { 
            return;
        }
        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (isReviewMode) {
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
    }, [allQuizQuestions, quizMetadata, isReviewMode, navigate, sectionType, topicId, quizId, userAnswers, submittedAnswers, userTimeSpent, markedQuestions, practiceTestSettings, getQuizStateKey, setError, hasPracticeTestStarted]);
    const handleFinishQuizRef = useRef(handleFinishQuiz);
    useEffect(() => { handleFinishQuizRef.current = handleFinishQuiz; }, [handleFinishQuiz]);


    const initializeNewQuizState = useCallback((ptSettings) => {
        // console.log(`[QuizPage INIT_NEW_QUIZ - ${quizId}] PT Settings:`, ptSettings, `Current quizMetadata:`, quizMetadata);
        setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
        setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
        setMarkedQuestions({}); setTempReveal({}); setIsReviewSummaryVisible(false); setCurrentQuestionIndexBeforeReview(0);

        if (sectionType === 'practice') {
            if (!quizMetadata) { 
                console.error(`[QuizPage INIT_NEW_QUIZ (PT) - ${quizId}]: quizMetadata is NULL.`);
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
            // console.log(`[QuizPage INIT_NEW_QUIZ (PT) - ${quizId}] PT started. Duration: ${duration}s. hasPracticeTestStarted: true.`);
        } else { 
            // console.log(`[QuizPage INIT_NEW_QUIZ (QBank) - ${quizId}]`);
            setTimerValue(0); setIsCountdown(false); setIsTimerActive(true); 
            setInitialDuration(0);
            setHasPracticeTestStarted(true); 
        }
    }, [topicId, sectionType, quizMetadata, quizId]);


    // Effect 1: Handles route changes (topicId, sectionType, quizId) & fetches core data
    useEffect(() => {
        isMountedRef.current = true;
        const quizInstanceKey = `${topicId}-${sectionType}-${quizId}`;
        // console.log(`[QuizPage EFFECT 1 (${quizInstanceKey})] Mount/Update. location.state:`, location.state);

        setIsLoading(true); 
        setError(null);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        setAllQuizQuestions([]);
        setQuizMetadata(null); 
        setHasPracticeTestStarted(false);
        setIsPracticeOptionsModalOpen(false);
        setCurrentQuestionIndex(0);
        setUserAnswers({}); setSubmittedAnswers({}); setShowExplanation({});
        setCrossedOffOptions({}); setUserTimeSpent({}); setMarkedQuestions({});
        setTempReveal({}); setIsReviewSummaryVisible(false);
        setTimerValue(0); setIsTimerActive(false);
        setPracticeTestSettings({ prometricDelay: false, additionalTime: false });
        setIsNavActionInProgress(false);

        const currentIsReview = location.state?.review || false;
        const currentReviewIdx = location.state?.questionIndex;
        setIsReviewMode(currentIsReview); 
        setReviewQuestionIndex(currentReviewIdx); 
        
        try {
            const localQuizData = getQuizData(topicId, sectionType, quizId);
            const localQuizMetadataInstance = getQuizMetadata(topicId, sectionType, quizId);

            if (!localQuizData || localQuizData.length === 0 || !localQuizMetadataInstance) {
                throw new Error(`Quiz data or metadata not found for ${quizInstanceKey}.`);
            }
            
            if (isMountedRef.current) {
                setAllQuizQuestions(localQuizData);
                setQuizMetadata(localQuizMetadataInstance); 
            }
        } catch (err) {
            console.error(`[QuizPage EFFECT 1 (${quizInstanceKey})] Critical error fetching data:`, err);
            if (isMountedRef.current) {
                setError(err.message || 'Failed to load quiz data.');
                setIsLoading(false); 
            }
        }
        
        const currentDebouncedHandler = debouncedSelectionChangeHandlerRef.current;
        if (currentDebouncedHandler) document.addEventListener('selectionchange', currentDebouncedHandler);

        return () => {
            isMountedRef.current = false;
            saveStateRef.current();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (currentDebouncedHandler) document.removeEventListener('selectionchange', currentDebouncedHandler);
        };
    }, [topicId, sectionType, quizId, location.state]);


    // Effect 2: Handles quiz setup AFTER quizMetadata and questions are loaded, and review mode is determined.
    useEffect(() => {
        const quizInstanceKey = `${topicId}-${sectionType}-${quizId}`;
        
        if (!quizMetadata || !allQuizQuestions || allQuizQuestions.length === 0) {
            if (!error && isLoading) { /* console.log waiting */ }
            else if (error) { if (isMountedRef.current) setIsLoading(false); }
            return; 
        }
        
        if (isReviewMode) {
            setIsPracticeOptionsModalOpen(false); 
            setHasPracticeTestStarted(true); 
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
                    const jumpToIndex = reviewQuestionIndex !== undefined && reviewQuestionIndex !== null ? reviewQuestionIndex : 0;
                    setCurrentQuestionIndex(jumpToIndex);
                    setShowExplanation({ [jumpToIndex]: true }); 
                    setPracticeTestSettings(parsedResults.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                } catch (e) { console.error("Error parsing results for review:", e); }
            }
            setIsTimerActive(false); setTimerValue(0); setIsCountdown(false); setTempReveal({});
            if (isMountedRef.current) setIsLoading(false);

        } else { // Not review mode
            const savedStateString = localStorage.getItem(getQuizStateKey());
            if (savedStateString) {
                try {
                    const savedState = JSON.parse(savedStateString);
                    setPracticeTestSettings(savedState.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                    
                    if (sectionType === 'practice' && !savedState.hasPracticeTestStarted) {
                        setIsPracticeOptionsModalOpen(true); 
                        if (isMountedRef.current) setIsLoading(false); 
                    } else {
                        setHasPracticeTestStarted(savedState.hasPracticeTestStarted || (sectionType !== 'practice'));
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
                        
                        let initialShowExp = {}; 
                        if (sectionType === 'practice') {
                            Object.keys(savedState.submittedAnswers || {}).forEach(idx => {
                                initialShowExp[idx] = false; 
                            });
                        } else { 
                             initialShowExp = savedState.showExplanation || {};
                        }
                        setShowExplanation(initialShowExp);
                        
                        const jumpToFromNav = location.state?.jumpTo; 
                        if (jumpToFromNav === undefined) {
                            setIsReviewSummaryVisible(savedState.isReviewSummaryVisible || false);
                            setCurrentQuestionIndexBeforeReview(savedState.currentQuestionIndexBeforeReview || 0);
                        } else { 
                            setIsReviewSummaryVisible(false);
                            setCurrentQuestionIndex(jumpToFromNav);
                            setCurrentQuestionIndexBeforeReview(jumpToFromNav);
                            navigate(location.pathname, { replace: true, state: { ...location.state, jumpTo: undefined } });
                        }

                        if (!(savedState.isCountdown && savedState.timerValue <= 0) && (savedState.hasPracticeTestStarted || sectionType !== 'practice')) {
                            setIsTimerActive(true);
                        } else { setIsTimerActive(false); }
                        if (isMountedRef.current) setIsLoading(false);
                    }
                } catch (e) {
                    console.error(`[QuizPage EFFECT 2 (${quizInstanceKey})] Error loading saved state, re-initializing:`, e);
                    localStorage.removeItem(getQuizStateKey());
                    if (sectionType === 'practice') {
                        setIsPracticeOptionsModalOpen(true); 
                        if (isMountedRef.current) setIsLoading(false); 
                    } else {
                        initializeNewQuizState(null); 
                        if (isMountedRef.current) setIsLoading(false);
                    }
                }
            } else { 
                if (sectionType === 'practice') {
                    setIsPracticeOptionsModalOpen(true); 
                    if (isMountedRef.current) setIsLoading(false); 
                } else { 
                    initializeNewQuizState(null); 
                    if (isMountedRef.current) setIsLoading(false);
                }
            }
        }
    }, [quizMetadata, allQuizQuestions, isReviewMode, reviewQuestionIndex, 
        topicId, sectionType, quizId, 
        getQuizStateKey, initializeNewQuizState, navigate, location.state, error
    ]);


    const handlePracticeTestOptionsClose = useCallback(() => {
        setIsPracticeOptionsModalOpen(false);
        if (!hasPracticeTestStarted) {
            if (isMountedRef.current) setIsLoading(false); 
            navigate(`/topic/${topicId}`);
        }
    }, [navigate, topicId, hasPracticeTestStarted, quizId]);

    const handleStartPracticeTest = useCallback((settings) => {
        setPracticeTestSettings(settings); 
        setIsPracticeOptionsModalOpen(false); 
        initializeNewQuizState(settings); 
    }, [initializeNewQuizState, quizId]);

    useEffect(() => {
        if (allQuizQuestions && allQuizQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < allQuizQuestions.length) {
            const currentQData = allQuizQuestions[currentQuestionIndex];
            if (currentQData && !currentQData.error && currentQData.passage && currentQData.passage.html_content) {
                setPassageHtml(cleanPassageHtml(currentQData.passage.html_content));
            } else { setPassageHtml(null); }
        } else { setPassageHtml(null); }
    }, [currentQuestionIndex, allQuizQuestions]);

    const toggleHighlight = useCallback(() => { /* ... */ }, []);

    const handleActualSelectionChange = useCallback(() => {
        if (isNavActionInProgress || isReviewMode || !highlightButtonRef.current || !quizPageContainerRef.current || isPracticeOptionsModalOpen || !hasPracticeTestStarted) return;
        // ...
    }, [isNavActionInProgress, isReviewMode, isPracticeOptionsModalOpen, hasPracticeTestStarted]);

    useEffect(() => {
        debouncedSelectionChangeHandlerRef.current = debounce(handleActualSelectionChange, 150);
    }, [handleActualSelectionChange]);


    const handleContainerClick = useCallback((event) => {
        if (isNavActionInProgress || isReviewMode || !quizPageContainerRef.current || isPracticeOptionsModalOpen || !hasPracticeTestStarted) { return; }
        // ...
    }, [isNavActionInProgress, isReviewMode, isPracticeOptionsModalOpen, hasPracticeTestStarted]);

    useEffect(() => {
        if (isTimerActive && !isReviewMode && hasPracticeTestStarted && !isNavActionInProgress) {
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
    }, [isTimerActive, isCountdown, isReviewMode, hasPracticeTestStarted, quizId, handleFinishQuizRef, isNavActionInProgress]); 


    useEffect(() => {
        if (!isLoading && allQuizQuestions?.length > 0 && currentQuestionIndex >= 0 && !isReviewMode && hasPracticeTestStarted && !isNavActionInProgress) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (!isReviewSummaryVisible && currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex] && !tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else if (isReviewSummaryVisible || submittedAnswers[currentQuestionIndex] || tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = null;
            }
        }
    }, [currentQuestionIndex, isLoading, allQuizQuestions, submittedAnswers, isReviewMode, tempReveal, isReviewSummaryVisible, hasPracticeTestStarted, isNavActionInProgress]);

    const toggleSolutionReveal = useCallback(() => {
        if (!hasPracticeTestStarted || isNavActionInProgress) return; 
        if (sectionType === 'qbank' && !isReviewMode && allQuizQuestions.length > 0 && allQuizQuestions[currentQuestionIndex] && !allQuizQuestions[currentQuestionIndex].error ) {
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
    }, [sectionType, isReviewMode, allQuizQuestions, currentQuestionIndex, tempReveal, hasPracticeTestStarted, isNavActionInProgress]);

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (!hasPracticeTestStarted || isReviewSummaryVisible || isPracticeOptionsModalOpen || isNavActionInProgress) return; 
            if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                toggleSolutionReveal();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => { window.removeEventListener('keydown', handleKeyPress); };
    }, [toggleSolutionReveal, isReviewSummaryVisible, isPracticeOptionsModalOpen, hasPracticeTestStarted, isNavActionInProgress]);

    const handleOptionSelect = useCallback((questionIndex, optionLabel) => { 
        if (!hasPracticeTestStarted || isNavActionInProgress) return; 
        const isPracticeTestActive = sectionType === 'practice' && !isReviewMode;
        
        let canSelectOption = false;
        if (isPracticeTestActive) {
            // In active PT, can always select/change answer if not crossed off
            canSelectOption = !crossedOffOptions[questionIndex]?.has(optionLabel);
        } else { // QBank
            canSelectOption = !submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex] && !crossedOffOptions[questionIndex]?.has(optionLabel);
        }

        if (canSelectOption) {
            setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
        }
    }, [isReviewMode, submittedAnswers, tempReveal, hasPracticeTestStarted, isNavActionInProgress, sectionType, crossedOffOptions]);

    const submitAnswerForIndex = useCallback((questionIndex) => { 
        if (!hasPracticeTestStarted) return 'test_not_started'; 
        if (!allQuizQuestions[questionIndex]) return 'error_question'; 
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (questionToSubmit.error) return 'error_question';
        
        if (isReviewMode || (sectionType === 'qbank' && tempReveal[questionIndex])) return true; 

        if (userAnswers[questionIndex] && !submittedAnswers[questionIndex]) {
            let elapsedSeconds = userTimeSpent[questionIndex] !== undefined ? userTimeSpent[questionIndex] : 0;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                questionStartTimeRef.current = null; 
            }
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            
            if (sectionType === 'qbank' && !isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: true })); 
            } else if (sectionType === 'practice' && !isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: false })); 
            }

            setTimeout(() => saveStateRef.current(), 0); 
            return true;
        } else if (submittedAnswers[questionIndex]) {
            return true; 
        }
        return 'no_answer_selected';  
    }, [allQuizQuestions, isReviewMode, tempReveal, userAnswers, submittedAnswers, userTimeSpent, hasPracticeTestStarted, sectionType]);

    const toggleExplanation = useCallback((questionIndex) => { 
        if (!hasPracticeTestStarted || isNavActionInProgress) return; 
        if (!allQuizQuestions[questionIndex]) return; 
        
        // For active practice test, this button should not be visible/callable based on QuestionCard logic.
        // This is an additional safeguard if called directly.
        if (sectionType === 'practice' && !isReviewMode && !tempReveal[questionIndex]) return;

        const currentTempRevealForQuestion = tempReveal[questionIndex];
        const currentShowExplanationForQuestion = showExplanation[questionIndex];

        if (sectionType === 'qbank' && !isReviewMode && currentTempRevealForQuestion !== undefined) {
             setTempReveal(prev => ({...prev, [questionIndex]: !currentShowExplanationForQuestion }));
        }
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    }, [sectionType, tempReveal, showExplanation, hasPracticeTestStarted, allQuizQuestions, isNavActionInProgress, isReviewMode]);

    const handleToggleCrossOff = useCallback((questionIndex, optionLabel) => { 
        if (!hasPracticeTestStarted || isNavActionInProgress) return; 
        const isPracticeTestActive = sectionType === 'practice' && !isReviewMode;
        const canToggle = isPracticeTestActive || (!submittedAnswers[questionIndex] && !isReviewMode && !tempReveal[questionIndex]);

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
    }, [isReviewMode, submittedAnswers, tempReveal, userAnswers, hasPracticeTestStarted, isNavActionInProgress, sectionType]);

    const handleToggleMark = useCallback((questionIndex) => { 
        if (!hasPracticeTestStarted ) return; // isNavActionInProgress checked by executeWithDelay
        if (!isReviewMode) { 
            setMarkedQuestions(prev => {
                const newState = { ...prev };
                newState[questionIndex] = !newState[questionIndex];
                return newState;
            });
            setTimeout(() => saveStateRef.current(), 0);
        }
    }, [isReviewMode, hasPracticeTestStarted]);

    const executeWithDelay = useCallback((actionFn, isNonNavFooterAction = false) => {
        if (!hasPracticeTestStarted && !isReviewMode) { 
            if(!isReviewMode && !isNonNavFooterAction) { 
                 // console.log("[executeWithDelay] Aborted: Test not started (active quiz).");
                return;
            }
        }
        if (isNavActionInProgress && !isNonNavFooterAction) { 
            // console.log("[executeWithDelay] Aborted: Another navigation action is already in progress.");
            return;
        }

        const prometricShouldApply = (sectionType === 'practice' || isReviewMode) && practiceTestSettings.prometricDelay;

        if (prometricShouldApply) { // Apply delay for all actions passed through here if setting is on
            // For non-nav footer actions like "Mark", we still set isNavActionInProgress to disable other buttons
            setIsNavActionInProgress(true);
            setTimeout(() => {
                actionFn();
                if(isMountedRef.current) setIsNavActionInProgress(false);
            }, 2000);
        } else {
            actionFn(); 
        }
    }, [hasPracticeTestStarted, isReviewMode, sectionType, practiceTestSettings.prometricDelay, isNavActionInProgress]);


    const handleJumpToQuestion = useCallback((index, fromSummaryTable = false) => { 
        if (!hasPracticeTestStarted && !isReviewMode) return; 

        const jumpAction = () => { 
            if (index >= 0 && index < allQuizQuestions.length) {
                 if (tempReveal[currentQuestionIndex] && !isReviewMode) { 
                    setTempReveal(prev => ({...prev, [currentQuestionIndex]: false}));
                }
                setCurrentQuestionIndex(index);
                if (isReviewMode) { 
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
     }, [allQuizQuestions, isReviewMode, tempReveal, currentQuestionIndex, submittedAnswers, executeWithDelay, hasPracticeTestStarted, sectionType, isReviewSummaryVisible]);

    const handleSubmitAndNavigate = useCallback(() => { 
        if (!hasPracticeTestStarted) return; 
        const submissionResult = submitAnswerForIndex(currentQuestionIndex);
        const navigateAction = () => { 
            if (tempReveal[currentQuestionIndex] && !isReviewMode) {
                setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
            }
            if (currentQuestionIndex < allQuizQuestions.length - 1) {
                const nextIndex = currentQuestionIndex + 1;
                setCurrentQuestionIndex(nextIndex);
                setTempReveal(prev => ({ ...prev, [nextIndex]: false })); 
                
                if (sectionType === 'practice' && !isReviewMode) {
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
    }, [allQuizQuestions, currentQuestionIndex, submitAnswerForIndex, tempReveal, submittedAnswers, executeWithDelay, hasPracticeTestStarted, sectionType]);

    const handlePrevious = useCallback(() => { 
        if (!hasPracticeTestStarted) return; 
        const navigateAction = () => { 
            if (currentQuestionIndex > 0) {
                if (tempReveal[currentQuestionIndex] && !isReviewMode) {
                    setTempReveal(prev => ({ ...prev, [currentQuestionIndex]: false }));
                }
                const prevIndex = currentQuestionIndex - 1;
                setCurrentQuestionIndex(prevIndex);
                setTempReveal(prev => ({ ...prev, [prevIndex]: false }));
                 
                if (sectionType === 'practice' && !isReviewMode) {
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                } else if (submittedAnswers[prevIndex]) { 
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: true }));
                } else { 
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                }
            }
         };
        executeWithDelay(navigateAction, false);
    }, [currentQuestionIndex, tempReveal, submittedAnswers, executeWithDelay, hasPracticeTestStarted, sectionType]);
    
    const handleOpenReviewSummary = useCallback(() => { 
        if (!hasPracticeTestStarted) return;
        executeWithDelay(() => { 
            setIsReviewSummaryVisible(true); 
            setCurrentQuestionIndexBeforeReview(currentQuestionIndex);
        }, false); 
    }, [hasPracticeTestStarted, currentQuestionIndex, executeWithDelay]);

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

                    <MemoizedPassage html={passageHtml} passageRef={passageContainerRef} />
                    <button ref={highlightButtonRef} className="highlight-popup-button" style={{ display: 'none' }} onClick={toggleHighlight} onMouseDown={(e) => e.preventDefault()}> Highlight </button>

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
                                    onClick={() => executeWithDelay(() => handleToggleMark(currentQuestionIndex), false)} // Apply delay to Mark
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