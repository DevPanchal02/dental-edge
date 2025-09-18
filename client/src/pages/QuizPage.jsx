import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { getQuizData, getQuizMetadata, formatDisplayName } from '../services/loader';
import QuestionCard from '../components/QuestionCard';
import QuizReviewSummary from '../components/QuizReviewSummary';
import PracticeTestOptions from '../components/PracticeTestOptions';
import Exhibit from '../components/Exhibit';
import { useLayout } from '../context/LayoutContext';
import '../styles/QuizPage.css';
import RegistrationPromptModal from '../components/RegistrationPromptModal';
import { useAuth } from '../context/AuthContext';
import { FaChevronLeft } from 'react-icons/fa';

// --- Utility Functions (No changes) ---
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}
const cleanPassageHtml = (htmlString) => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    let cleanedHtml = htmlString.replace(/<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
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
const MemoizedPassage = React.memo(function MemoizedPassage({ html, passageRef, ...rest }) {
    if (!html) { return null; }
    return (<div className="passage-container" ref={passageRef} dangerouslySetInnerHTML={{ __html: html }} {...rest} />);
});
const EMPTY_SET = new Set();


function QuizPage({ isPreviewMode = false }) {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
const { currentUser } = useAuth();
const layout = !isPreviewMode ? useLayout() : { isSidebarEffectivelyPinned: false };
const { isSidebarEffectivelyPinned } = layout;

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
    const activeNavTimeoutsRef = useRef(new Set());
    const [isExhibitVisible, setIsExhibitVisible] = useState(false);
    const [highlightedHtml, setHighlightedHtml] = useState({});
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const latestStateRef = useRef({});
    useEffect(() => {
        latestStateRef.current = {
            isReviewMode, hasPracticeTestStarted, isPracticeOptionsModalOpen, isNavActionInProgress,
            practiceTestSettings, currentQuestionIndex, allQuizQuestionsLength: allQuizQuestions.length,
            tempReveal, submittedAnswers, sectionType, isMounted: isMountedRef.current, isLoading,
            isExhibitVisible,
        };
    }, [
        isReviewMode, hasPracticeTestStarted, isPracticeOptionsModalOpen, isNavActionInProgress,
        practiceTestSettings, currentQuestionIndex, allQuizQuestions.length, tempReveal,
        submittedAnswers, sectionType, isLoading, isExhibitVisible
    ]);
    const getQuizStateKey = useCallback(() => {
        return `quizState-${topicId}-${sectionType}-${quizId}`;
    }, [topicId, sectionType, quizId]);

    const saveState = useCallback(() => {
        if (latestStateRef.current.isReviewMode || !latestStateRef.current.isMounted || (latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.hasPracticeTestStarted)) {
            return;
        }
        const stateToSave = {
            currentQuestionIndex, userAnswers, submittedAnswers, userTimeSpent,
            timerValue, isCountdown, initialDuration, markedQuestions, tempReveal, showExplanation,
            isReviewSummaryVisible, currentQuestionIndexBeforeReview,
            hasPracticeTestStarted: latestStateRef.current.hasPracticeTestStarted,
            practiceTestSettings,
            highlightedHtml,
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
        practiceTestSettings, sectionType, highlightedHtml
    ]);
    const saveStateRef = useRef(saveState);
    useEffect(() => { saveStateRef.current = saveState; }, [saveState]);

    const handleFinishQuiz = useCallback((timedOut = false) => {
        if (!latestStateRef.current.isMounted || (latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isReviewMode)) {
            return;
        }
        setIsTimerActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        activeNavTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
        activeNavTimeoutsRef.current.clear();
        setIsNavActionInProgress(false);

        if (latestStateRef.current.isReviewMode) {
            navigate(`/app/results/${topicId}/${sectionType}/${quizId}`);
            return;
        }
        let score = 0;
        let correctIndices = [];
        let incorrectIndices = [];
        if (!allQuizQuestions || allQuizQuestions.length === 0 || !quizMetadata) {
            setError("Could not finalize quiz due to missing data.");
            if (latestStateRef.current.isMounted) setIsLoading(false);
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
            } else if (timedOut && latestStateRef.current.sectionType === 'practice') {
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
        if (latestStateRef.current.isMounted) setIsLoading(false);
        navigate(`/app/results/${topicId}/${sectionType}/${quizId}`, { replace: true });
    }, [allQuizQuestions, quizMetadata, navigate, sectionType, topicId, quizId, userAnswers, submittedAnswers, userTimeSpent, markedQuestions, practiceTestSettings, getQuizStateKey, setError]);
    const handleFinishQuizRef = useRef(handleFinishQuiz);
    useEffect(() => { handleFinishQuizRef.current = handleFinishQuiz; }, [handleFinishQuiz]);

    // This callback remains, but we will no longer use it in the main useEffect.
    // It's still needed for handleStartPracticeTest.
    const initializeNewQuizState = useCallback((ptSettings) => {
        setCurrentQuestionIndex(0); setUserAnswers({}); setSubmittedAnswers({});
        setShowExplanation({}); setCrossedOffOptions({}); setUserTimeSpent({});
        setMarkedQuestions({}); setTempReveal({}); setIsReviewSummaryVisible(false); setCurrentQuestionIndexBeforeReview(0);
        setHighlightedHtml({});
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
        activeNavTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
        activeNavTimeoutsRef.current.clear();
        setIsNavActionInProgress(false);
    }, [topicId, sectionType, quizMetadata]);

    const executeWithDelay = useCallback((actionFn, isPageTransitionLike = true) => {
        if (!latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isReviewMode) {
            const isFinishingOrNavigatingBack =
                actionFn === handleFinishQuizRef.current ||
                (typeof actionFn === 'function' && actionFn.toString().includes("navigate("));
            if (!isFinishingOrNavigatingBack) return;
        }
        const prometricShouldApply = isPageTransitionLike &&
            (latestStateRef.current.sectionType === 'practice' || latestStateRef.current.isReviewMode) &&
            latestStateRef.current.practiceTestSettings.prometricDelay;
        if (prometricShouldApply) {
            setIsNavActionInProgress(true);
            const timeoutId = setTimeout(() => {
                if (latestStateRef.current.isMounted) {
                    actionFn();
                    activeNavTimeoutsRef.current.delete(timeoutId);
                    if (activeNavTimeoutsRef.current.size === 0) {
                        setIsNavActionInProgress(false);
                    }
                }
            }, 2000);
            activeNavTimeoutsRef.current.add(timeoutId);
        } else {
            actionFn();
        }
    }, []);

    // Main data loading effect - loop is now fixed.
       useEffect(() => {
        isMountedRef.current = true;
    
        const loadQuizAndInitialize = async () => {
            setIsLoading(true);
            setError(null);
            setAllQuizQuestions([]);
            setQuizMetadata(null);
            setHasPracticeTestStarted(false);
            setIsPracticeOptionsModalOpen(false);
            setCurrentQuestionIndex(0);
            setUserAnswers({});
            setSubmittedAnswers({});
            setMarkedQuestions({});
    
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            activeNavTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
            activeNavTimeoutsRef.current.clear();
            setIsNavActionInProgress(false);
    
            // --- PREVIEW MODE LOGIC ---
            if (isPreviewMode) {
                try {
                    const previewData = await getQuizData(topicId, sectionType, quizId);
                    if (!isMountedRef.current) return;
                    if (!previewData || previewData.length === 0) {
                        throw new Error('Preview quiz data could not be loaded.');
                    }
                    
                    // --- THIS IS THE FIX ---
                    const previewMetadata = {
                        fullNameForDisplay: 'Dental Aptitude Test 1',
                        categoryForInstructions: 'Biology',
                        totalQuestions: 210, // Display 210
                        baseTimeLimitMinutes: 180,
                    };

                    setAllQuizQuestions(previewData); // But only load the 2 actual questions
                    setQuizMetadata(previewMetadata);
                    setIsPracticeOptionsModalOpen(true);
                    setHasPracticeTestStarted(false);
                } catch (err) {
                    if (isMountedRef.current) setError(err.message);
                } finally {
                    if (isMountedRef.current) setIsLoading(false);
                }
                return;
            }
    
            // --- REGISTERED USER LOGIC ---
            const currentReviewStatus = location.state?.review || false;
            const currentReviewIdx = location.state?.questionIndex ?? 0;
            setIsReviewMode(currentReviewStatus);
            setReviewQuestionIndex(currentReviewIdx);
    
            try {
                const [loadedQuizData, initialMetadata] = await Promise.all([
                    getQuizData(topicId, sectionType, quizId),
                    getQuizMetadata(topicId, sectionType, quizId)
                ]);
    
                if (!isMountedRef.current) return;
                if (!loadedQuizData || loadedQuizData.length === 0 || !initialMetadata) {
                    throw new Error(`Essential quiz data or metadata not found.`);
                }
                
                const finalMetadata = {
                    ...initialMetadata,
                    totalQuestions: loadedQuizData.filter(q => q && !q.error).length
                };
    
                setAllQuizQuestions(loadedQuizData);
                setQuizMetadata(finalMetadata);
    
                if (currentReviewStatus) {
                    const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
                    const savedResultsString = localStorage.getItem(resultsKey);
                    if (savedResultsString) {
                        const parsedResults = JSON.parse(savedResultsString);
                        setUserAnswers(parsedResults.userAnswers || {});
                        setMarkedQuestions(parsedResults.markedQuestions || {});
                        const allSubmitted = {};
                        loadedQuizData.forEach((_, index) => { allSubmitted[index] = true; });
                        setSubmittedAnswers(allSubmitted);
                        setCurrentQuestionIndex(currentReviewIdx);
                        setPracticeTestSettings(parsedResults.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                    }
                    setHasPracticeTestStarted(true);
                    setIsTimerActive(false);
                } else {
                    const savedStateString = localStorage.getItem(getQuizStateKey());
                    if (savedStateString) {
                        const savedState = JSON.parse(savedStateString);
                        setPracticeTestSettings(savedState.practiceTestSettings || { prometricDelay: false, additionalTime: false });
                        if (sectionType === 'practice' && !savedState.hasPracticeTestStarted) {
                            setIsPracticeOptionsModalOpen(true);
                            setHasPracticeTestStarted(false);
                        } else {
                            setHasPracticeTestStarted(savedState.hasPracticeTestStarted || (sectionType !== 'practice'));
                            setCurrentQuestionIndex(savedState.currentQuestionIndex || 0);
                            setUserAnswers(savedState.userAnswers || {});
                            setCrossedOffOptions(savedState.crossedOffOptions ? Object.fromEntries(Object.entries(savedState.crossedOffOptions).map(([k, v]) => [k, new Set(v)])) : {});
                            setUserTimeSpent(savedState.userTimeSpent || {});
                            setMarkedQuestions(savedState.markedQuestions || {});
                            setTimerValue(savedState.timerValue !== undefined ? savedState.timerValue : 0);
                            setIsCountdown(savedState.isCountdown !== undefined ? savedState.isCountdown : false);
                            setInitialDuration(savedState.initialDuration || 0);
                            setIsTimerActive(savedState.hasPracticeTestStarted || sectionType !== 'practice');
                        }
                    } else {
                        if (sectionType === 'practice') {
                            setIsPracticeOptionsModalOpen(true);
                            setHasPracticeTestStarted(false);
                        } else {
                            initializeNewQuizState();
                        }
                    }
                }
            } catch (err) {
                if (isMountedRef.current) {
                    if (err.code === 'upgrade_required') {
                        navigate('/plans');
                    } else {
                        setError(err.message);
                    }
                }
            } finally {
                if (isMountedRef.current) setIsLoading(false);
            }
        };
    
        loadQuizAndInitialize();
    
        return () => {
            isMountedRef.current = false;
            if (!isPreviewMode) {
              saveStateRef.current();
            }
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            activeNavTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
            activeNavTimeoutsRef.current.clear();
        };
    }, [topicId, sectionType, quizId, location.state?.review, location.state?.questionIndex, getQuizStateKey, navigate, isPreviewMode]);
       const handlePrevious = useCallback(() => {
        const actionFn = () => {
            const { currentQuestionIndex: cqIdx, tempReveal: lTempReveal, isReviewMode: lIsReviewMode, sectionType: lSectionType, submittedAnswers: lSubmittedAnswers } = latestStateRef.current;
            if (latestStateRef.current.isExhibitVisible) {
                setIsExhibitVisible(false);
            }
            if (cqIdx > 0) {
                if (lTempReveal[cqIdx] && !lIsReviewMode) {
                    setTempReveal(prev => ({ ...prev, [cqIdx]: false }));
                }
                const prevIndex = cqIdx - 1;
                setCurrentQuestionIndex(prevIndex);
                setTempReveal(prev => ({ ...prev, [prevIndex]: false }));
                if (lSectionType === 'practice' && !lIsReviewMode) {
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                } else if (lSubmittedAnswers[prevIndex]) {
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: true }));
                } else {
                    setShowExplanation(prev => ({ ...prev, [prevIndex]: false }));
                }
            }
        };
        executeWithDelay(actionFn);
    }, [executeWithDelay, setCurrentQuestionIndex, setTempReveal, setShowExplanation]);

    const handleOpenReviewSummary = useCallback(() => {
        const actionFn = () => {
            setIsReviewSummaryVisible(true);
            setCurrentQuestionIndexBeforeReview(latestStateRef.current.currentQuestionIndex);
        };
        executeWithDelay(actionFn);
    }, [executeWithDelay, setIsReviewSummaryVisible, setCurrentQuestionIndexBeforeReview]);
    
    const handleCloseReviewSummary = useCallback(() => {
        const actionFn = () => {
            setIsReviewSummaryVisible(false);
        };
        executeWithDelay(actionFn, false);
    }, [executeWithDelay]);

    const handleJumpToQuestion = useCallback((index, fromSummaryTable = false) => {
        const actionFn = () => {
            const { allQuizQuestionsLength: aqLength, tempReveal: lTempReveal, isReviewMode: lIsReviewMode, sectionType: lSectionType, submittedAnswers: lSubmittedAnswers, currentQuestionIndex: cqIdx } = latestStateRef.current;
            if (index >= 0 && index < aqLength) {
                if (lTempReveal[cqIdx] && !lIsReviewMode) {
                    setTempReveal(prev => ({ ...prev, [cqIdx]: false }));
                }
                setCurrentQuestionIndex(index);
                if (lIsReviewMode) {
                    setShowExplanation({ [index]: true });
                } else {
                    setTempReveal(prev => ({ ...prev, [index]: false }));
                    if (lSectionType === 'practice') {
                        setShowExplanation(prev => ({ ...prev, [index]: false }));
                    } else if (lSubmittedAnswers[index]) {
                        setShowExplanation(prev => ({ ...prev, [index]: true }));
                    } else {
                        setShowExplanation(prev => ({ ...prev, [index]: false }));
                    }
                }
                setIsReviewSummaryVisible(false);
            }
        };
        if (fromSummaryTable) {
            actionFn();
        } else {
            executeWithDelay(actionFn);
        }
    }, [executeWithDelay, setCurrentQuestionIndex, setTempReveal, setShowExplanation, setIsReviewSummaryVisible]);

    const handlePracticeTestOptionsClose = useCallback(() => {
        setIsPracticeOptionsModalOpen(false);
        if (!hasPracticeTestStarted) {
            if (isMountedRef.current) setIsLoading(false);
            navigate(`/app/topic/${topicId}`);
        }
    }, [navigate, topicId, hasPracticeTestStarted]);

    // This now correctly depends on quizMetadata from state, which is fine
    // because this is only called on a user interaction (clicking start).
const handleStartPracticeTest = useCallback((settings) => {
        setPracticeTestSettings(settings);
        setIsPracticeOptionsModalOpen(false);

        if (isPreviewMode) {
            const duration = 180 * 60; // 180 minutes for preview
            setTimerValue(duration);
            setInitialDuration(duration);
            setIsCountdown(true);
            setIsTimerActive(true);
            setHasPracticeTestStarted(true);
            return;
        }
        
        // This is the original logic for registered users
        initializeNewQuizState(settings);
    }, [initializeNewQuizState, isPreviewMode]);

    // --- All remaining functions and the final JSX render block are unchanged. ---
    useEffect(() => {
        if (allQuizQuestions && allQuizQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < allQuizQuestions.length) {
            const currentQData = allQuizQuestions[currentQuestionIndex];
            if (currentQData && !currentQData.error && currentQData.passage && currentQData.passage.html_content) {
                const cleanHtml = cleanPassageHtml(currentQData.passage.html_content)
                if (passageHtml !== cleanHtml) {
                    setPassageHtml(cleanHtml);
                }
                if (passageContainerRef.current) {
                    passageContainerRef.current.scrollTop = 0;
                }
            } else {
                setPassageHtml(null);
            }
        } else {
            setPassageHtml(null);
        }
    }, [currentQuestionIndex, allQuizQuestions]);
    const updateHighlightedContent = useCallback((element) => {
        if (element && element.dataset && element.dataset.contentKey) {
            const key = element.dataset.contentKey;
            if (!key || key.includes('undefined')) {
                console.warn("Attempted to save highlight with an invalid key:", key);
                return;
            }
            const newHtml = element.innerHTML;
            setHighlightedHtml(prev => ({ ...prev, [key]: newHtml }));
            setTimeout(() => saveStateRef.current(), 0);
        }
    }, []);
    const toggleHighlight = useCallback(() => {
        if (latestStateRef.current.isNavActionInProgress || !highlightButtonRef.current || !highlightButtonRef.current._selectionRange) {
            if (highlightButtonRef.current) highlightButtonRef.current.style.display = 'none';
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
            const container = mark.closest('[data-content-key]');
            updateHighlightedContent(container);
        }
        catch (e) { console.warn("[HL] toggleHighlight: range.surroundContents() failed. Error:", e); }
        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        const currentSelection = window.getSelection();
        if (currentSelection) currentSelection.removeAllRanges();
    }, [updateHighlightedContent]);
    const handleActualSelectionChange = useCallback(() => {
        const {
            hasPracticeTestStarted: l_hasPracticeTestStarted, isPracticeOptionsModalOpen: l_isPracticeOptionsModalOpen,
            isNavActionInProgress: l_isNavActionInProgress, isLoading: l_isLoading
        } = latestStateRef.current;
        if (!l_hasPracticeTestStarted || l_isPracticeOptionsModalOpen || l_isNavActionInProgress || l_isLoading || !highlightButtonRef.current || !quizPageContainerRef.current) {
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
            if (commonAncestor.nodeType === Node.TEXT_NODE) commonAncestor = commonAncestor.parentNode;
            const targetContainer = commonAncestor.closest('[data-content-key]');
            if (targetContainer && range.toString().trim() !== "") {
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
        if (currentDebouncedHandler) document.addEventListener('selectionchange', currentDebouncedHandler);
        return () => { if (currentDebouncedHandler) document.removeEventListener('selectionchange', currentDebouncedHandler); };
    }, [handleActualSelectionChange]);
    const handleContainerClick = useCallback((event) => {
        const {
            hasPracticeTestStarted: l_hasPracticeTestStarted, isPracticeOptionsModalOpen: l_isPracticeOptionsModalOpen,
            isNavActionInProgress: l_isNavActionInProgress, isLoading: l_isLoading
        } = latestStateRef.current;
        if (!l_hasPracticeTestStarted || l_isPracticeOptionsModalOpen || l_isNavActionInProgress || l_isLoading || !quizPageContainerRef.current) return;
        const clickedElement = event.target;
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) return;
        const markElement = clickedElement.closest('mark.custom-highlight');
        const containerWithKey = clickedElement.closest('[data-content-key]');
        if (markElement && containerWithKey) {
            const parentOfMark = markElement.parentNode;
            if (parentOfMark) {
                while (markElement.firstChild) parentOfMark.insertBefore(markElement.firstChild, markElement);
                parentOfMark.removeChild(markElement);
                parentOfMark.normalize();
                updateHighlightedContent(containerWithKey);
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
        if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0 || selection.toString().trim() === "") {
                highlightButtonRef.current.style.display = 'none';
                highlightButtonRef.current._selectionRange = null;
                if (selection) selection.removeAllRanges();
            }
        }
    }, [updateHighlightedContent]);
    useEffect(() => {
        if (isTimerActive && !latestStateRef.current.isReviewMode && latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isNavActionInProgress) {
            timerIntervalRef.current = setInterval(() => {
                setTimerValue(prevTime => {
                    if (isCountdown) {
                        const newTime = prevTime - 1;
                        if (newTime <= 0) {
                            clearInterval(timerIntervalRef.current);
                            timerIntervalRef.current = null;
                            if (latestStateRef.current.isMounted) {
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
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isTimerActive, isCountdown]);
    useEffect(() => {
        if (!latestStateRef.current.isLoading && latestStateRef.current.allQuizQuestionsLength > 0 && currentQuestionIndex >= 0 && !latestStateRef.current.isReviewMode && latestStateRef.current.hasPracticeTestStarted && !latestStateRef.current.isNavActionInProgress) {
            const currentQ = allQuizQuestions[currentQuestionIndex];
            if (!isReviewSummaryVisible && currentQ && !currentQ.error && !submittedAnswers[currentQuestionIndex] && !tempReveal[currentQuestionIndex]) {
                questionStartTimeRef.current = Date.now();
            } else if (isReviewSummaryVisible || submittedAnswers[currentQuestionIndex] || tempReveal[currentQuestionIndex] || latestStateRef.current.isNavActionInProgress) {
                questionStartTimeRef.current = null;
            }
        }
    }, [currentQuestionIndex, allQuizQuestions, submittedAnswers, tempReveal, isReviewSummaryVisible]);
    const toggleExhibit = useCallback(() => {
        setIsExhibitVisible(prev => !prev);
    }, []);
    const toggleSolutionReveal = useCallback(() => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return;
        if (latestStateRef.current.sectionType === 'qbank' && !latestStateRef.current.isReviewMode && latestStateRef.current.allQuizQuestionsLength > 0 && allQuizQuestions[latestStateRef.current.currentQuestionIndex] && !allQuizQuestions[latestStateRef.current.currentQuestionIndex].error) {
            const qIndex = latestStateRef.current.currentQuestionIndex;
            setTempReveal(prev => {
                const newRevealStateForCurrent = !prev[qIndex];
                if (newRevealStateForCurrent && questionStartTimeRef.current) {
                    const endTime = Date.now();
                    const elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                    setUserTimeSpent(prevTS => ({ ...prevTS, [qIndex]: (prevTS[qIndex] || 0) + elapsedSeconds }));
                    questionStartTimeRef.current = null;
                } else if (!newRevealStateForCurrent && !latestStateRef.current.submittedAnswers[qIndex]) {
                    questionStartTimeRef.current = Date.now();
                }
                return { ...prev, [qIndex]: newRevealStateForCurrent };
            });
            setShowExplanation(prevExp => ({ ...prevExp, [qIndex]: !tempReveal[qIndex] }));
        }
    }, [allQuizQuestions, setUserTimeSpent, setShowExplanation]);
    useEffect(() => {
        const handleKeyPress = (event) => {
            const isChemistryQuiz = topicId === 'chemistry';
            if (isChemistryQuiz && (event.key === 'e' || event.key === 'E')) {
                if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.preventDefault();
                    executeWithDelay(toggleExhibit, true);
                    return;
                }
            }
            if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isReviewSummaryVisible || latestStateRef.current.isPracticeOptionsModalOpen || latestStateRef.current.isNavActionInProgress) return;
            const isTextInput = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;
            if (isTextInput) return;
            if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                toggleSolutionReveal();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => { window.removeEventListener('keydown', handleKeyPress); };
    }, [toggleSolutionReveal, toggleExhibit, topicId, executeWithDelay]);
    const handleOptionSelect = useCallback((questionIndex, optionLabel) => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return;
        const isPracticeTestActive = latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.isReviewMode;
        let canSelectOption = false;
        if (isPracticeTestActive) {
            canSelectOption = !crossedOffOptions[questionIndex]?.has(optionLabel);
        } else {
            canSelectOption = !latestStateRef.current.submittedAnswers[questionIndex] && !latestStateRef.current.isReviewMode && !latestStateRef.current.tempReveal[questionIndex] && !crossedOffOptions[questionIndex]?.has(optionLabel);
        }
        if (canSelectOption) setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionLabel }));
    }, [crossedOffOptions]);
    const submitAnswerForIndex = useCallback((questionIndex) => {
        if (!latestStateRef.current.hasPracticeTestStarted) return 'test_not_started';
        if (!allQuizQuestions[questionIndex]) return 'error_question';
        const questionToSubmit = allQuizQuestions[questionIndex];
        if (questionToSubmit.error) return 'error_question';
        if (latestStateRef.current.isReviewMode || (latestStateRef.current.sectionType === 'qbank' && latestStateRef.current.tempReveal[questionIndex])) return true;
        if (userAnswers[questionIndex] && !latestStateRef.current.submittedAnswers[questionIndex]) {
            let elapsedSeconds = userTimeSpent[questionIndex] !== undefined ? userTimeSpent[questionIndex] : 0;
            if (questionStartTimeRef.current) {
                const endTime = Date.now();
                elapsedSeconds = Math.round((endTime - questionStartTimeRef.current) / 1000);
                questionStartTimeRef.current = null;
            }
            setUserTimeSpent(prev => ({ ...prev, [questionIndex]: elapsedSeconds }));
            setSubmittedAnswers(prev => ({ ...prev, [questionIndex]: true }));
            if (latestStateRef.current.sectionType === 'qbank' && !latestStateRef.current.isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));
            } else if (latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.isReviewMode) {
                setShowExplanation(prev => ({ ...prev, [questionIndex]: false }));
            }
            setTimeout(() => saveStateRef.current(), 0);
            return true;
        } else if (latestStateRef.current.submittedAnswers[questionIndex]) {
            return true;
        }
        return 'no_answer_selected';
    }, [allQuizQuestions, userAnswers, userTimeSpent]);
    const toggleExplanation = useCallback((questionIndex) => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return;
        if (!allQuizQuestions[questionIndex]) return;
        if (latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.isReviewMode && !latestStateRef.current.tempReveal[questionIndex]) return;
        const currentTempRevealForQuestion = latestStateRef.current.tempReveal[questionIndex];
        const currentShowExplanationForQuestion = showExplanation[questionIndex];
        if (latestStateRef.current.sectionType === 'qbank' && !latestStateRef.current.isReviewMode && currentTempRevealForQuestion !== undefined) {
            setTempReveal(prev => ({ ...prev, [questionIndex]: !currentShowExplanationForQuestion }));
        }
        setShowExplanation((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    }, [allQuizQuestions, showExplanation]);
    const handleToggleCrossOff = useCallback((questionIndex, optionLabel) => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isNavActionInProgress) return;
        const isPracticeTestActive = latestStateRef.current.sectionType === 'practice' && !latestStateRef.current.isReviewMode;
        const canToggle = isPracticeTestActive || (!latestStateRef.current.submittedAnswers[questionIndex] && !latestStateRef.current.isReviewMode && !latestStateRef.current.tempReveal[questionIndex]);
        if (canToggle) {
            setCrossedOffOptions(prev => {
                const newCrossedOff = { ...prev };
                const currentSet = newCrossedOff[questionIndex] ? new Set(newCrossedOff[questionIndex]) : new Set();
                if (currentSet.has(optionLabel)) currentSet.delete(optionLabel);
                else currentSet.add(optionLabel);
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
    }, [userAnswers]);
    const handleToggleMark = useCallback((questionIndex) => {
        if (!latestStateRef.current.hasPracticeTestStarted || latestStateRef.current.isReviewMode || latestStateRef.current.isNavActionInProgress) return;
        const actionFn = () => {
            setMarkedQuestions(prev => {
                const newState = { ...prev };
                newState[questionIndex] = !newState[questionIndex];
                return newState;
            });
            setTimeout(() => saveStateRef.current(), 0);
        };
        executeWithDelay(actionFn, true);
    }, [executeWithDelay]);
    const handleSubmitAndNavigate = useCallback(() => {
        // --- THIS IS THE CORE PREVIEW LOGIC ---
        if (isPreviewMode && !currentUser && currentQuestionIndex === 1) {
            setIsRegistrationModalOpen(true);
            return; // Stop execution here for preview users
        }
        // --- END PREVIEW LOGIC ---

        const actionFn = () => {
            const { currentQuestionIndex: cqIdx, allQuizQuestionsLength: aqLength, tempReveal: lTempReveal, isReviewMode: lIsReviewMode, sectionType: lSectionType, submittedAnswers: lSubmittedAnswers } = latestStateRef.current;
            if (latestStateRef.current.isExhibitVisible) {
                setIsExhibitVisible(false);
            }
            submitAnswerForIndex(cqIdx);
            if (lTempReveal[cqIdx] && !lIsReviewMode) {
                setTempReveal(prev => ({ ...prev, [cqIdx]: false }));
            }
            if (cqIdx < aqLength - 1) {
                const nextIndex = cqIdx + 1;
                setCurrentQuestionIndex(nextIndex);
                setTempReveal(prev => ({ ...prev, [nextIndex]: false }));
                if (lSectionType === 'practice' && !lIsReviewMode) {
                    setShowExplanation(prev => ({ ...prev, [nextIndex]: false }));
                } else if (lSubmittedAnswers[nextIndex]) {
                    setShowExplanation(prev => ({ ...prev, [nextIndex]: true }));
                } else {
                    setShowExplanation(prev => ({ ...prev, [nextIndex]: false }));
                }
            } else {
                setIsReviewSummaryVisible(true);
                setCurrentQuestionIndexBeforeReview(cqIdx);
            }
        };
        const currentQ = allQuizQuestions[currentQuestionIndex];
        if (currentQ && currentQ.error) {
            executeWithDelay(() => {
                if (latestStateRef.current.isExhibitVisible) {
                    setIsExhibitVisible(false);
                }
                if (currentQuestionIndex < allQuizQuestions.length - 1) {
                    setCurrentQuestionIndex(currentQuestionIndex + 1);
                } else {
                    setIsReviewSummaryVisible(true);
                    setCurrentQuestionIndexBeforeReview(currentQuestionIndex);
                }
            });
        } else {
            executeWithDelay(actionFn);
        }
    }, [isPreviewMode, currentUser, currentQuestionIndex, allQuizQuestions, submitAnswerForIndex, executeWithDelay, setCurrentQuestionIndex, setTempReveal, setShowExplanation, setIsReviewSummaryVisible, setCurrentQuestionIndexBeforeReview]);
    const triggerFinishQuiz = useCallback(() => {
        executeWithDelay(() => handleFinishQuizRef.current(false));
    }, [executeWithDelay]);
    const quizPageContainerActiveStyle = {
        marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
        paddingBottom: isReviewSummaryVisible ? '0px' : '90px',
    };
    const sharedFixedFooterStyle = {
        left: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
    };
    const timerDisplayComponent = (
        <>
            {isCountdown ? 'Time Left: ' : 'Time Elapsed: '}
            <span className={isCountdown && timerValue < 60 && timerValue > 0 && timerValue !== initialDuration ? 'timer-low' : ''}> {formatTime(timerValue)} </span>
            {isCountdown && initialDuration > 0 && <span className="timer-total"> / {formatTime(initialDuration)}</span>}
        </>
    );
    if (isLoading) { return <div className="page-loading">Loading Quiz from Cloud...</div>; }
    if (error) { return (<div className="page-error"> Error: {error} <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>); }
        if (isPracticeOptionsModalOpen && (sectionType === 'practice' || isPreviewMode) && !isReviewMode) {
        if (!quizMetadata) { return <div className="page-loading">Preparing Test Options... (Waiting for metadata)</div>; }
        
        // Determine the base time. Use preview-specific time if in preview mode.
        const baseTimeMinutes = isPreviewMode 
            ? quizMetadata.baseTimeLimitMinutes 
            : Math.floor((PRACTICE_TEST_DURATIONS[quizMetadata.topicName?.toLowerCase().replace(/\s+/g, '-')] || PRACTICE_TEST_DURATIONS.default) / 60);

        const totalQuestions = isPreviewMode ? quizMetadata.totalQuestions : (allQuizQuestions.filter(q => q && !q.error).length);

        return (<PracticeTestOptions 
            isOpen={isPracticeOptionsModalOpen} 
            onClose={isPreviewMode ? () => navigate('/') : handlePracticeTestOptionsClose} 
            onStartTest={handleStartPracticeTest} 
            fullNameForDisplay={quizMetadata.fullNameForDisplay} 
            categoryForInstructions={quizMetadata.categoryForInstructions} 
            baseTimeLimitMinutes={baseTimeMinutes} 
            numQuestions={totalQuestions} 
        />);
    }
    if (sectionType === 'practice' && !hasPracticeTestStarted && !isPracticeOptionsModalOpen && !isReviewMode) { return <div className="page-loading">Preparing Practice Test...</div>; }
    if ((hasPracticeTestStarted || isReviewMode) && (!allQuizQuestions || allQuizQuestions.length === 0)) { return <div className="page-info"> No questions found for this quiz. Please check data files. <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>; }
    const currentQuestionData = allQuizQuestions[currentQuestionIndex];
    if (!isReviewSummaryVisible && (hasPracticeTestStarted || isReviewMode) && !currentQuestionData && allQuizQuestions.length > 0) { return <div className="page-error">Error: Could not load current question data. <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> Back to Topic </button> </div>; }
    const passageContentKey = passageHtml && currentQuestionData ? `passage_${currentQuestionData.category}` : null;
    const isPracticeTestActive = sectionType === 'practice' && !isReviewMode && hasPracticeTestStarted;
    const cardIsSubmittedState = (isPracticeTestActive && !!submittedAnswers[currentQuestionIndex]) || (!isPracticeTestActive && (!!submittedAnswers[currentQuestionIndex] || isReviewMode || !!tempReveal[currentQuestionIndex]));
    const explanationButtonShouldBeVisible = !!currentQuestionData?.explanation?.html_content && (isReviewMode || !!tempReveal[currentQuestionIndex] || (sectionType === 'qbank' && submittedAnswers[currentQuestionIndex]));
    const explanationContentShouldBeExpanded = showExplanation[currentQuestionIndex] && explanationButtonShouldBeVisible;
    const isLastQuestion = currentQuestionIndex === allQuizQuestions.length - 1;
    const currentCrossedOffForCard = crossedOffOptions[currentQuestionIndex] || EMPTY_SET;
    const currentIsMarkedForCard = !!markedQuestions[currentQuestionIndex];
    const isCurrentQuestionError = !!(currentQuestionData && currentQuestionData.error);
    const totalQuestionsForDisplay = isPreviewMode ? allQuizQuestions.length : (quizMetadata?.totalQuestions || allQuizQuestions.length);
    return (
        <div className={`quiz-page-container ${isPreviewMode ? 'preview-mode' : ''}`} ref={quizPageContainerRef} onClick={handleContainerClick} style={quizPageContainerActiveStyle}>

            <RegistrationPromptModal
                isOpen={isRegistrationModalOpen}
                onClose={() => setIsRegistrationModalOpen(false)}
            />
            {topicId === 'chemistry' && (
                <Exhibit
                    isVisible={isExhibitVisible}
                    onClose={toggleExhibit}
                />
            )}
            <button ref={highlightButtonRef} className="highlight-popup-button" style={{ display: 'none' }} onClick={toggleHighlight} onMouseDown={(e) => e.preventDefault()}> Highlight </button>
            {isReviewSummaryVisible ? (
                <QuizReviewSummary
                    allQuizQuestions={allQuizQuestions} quizMetadata={quizMetadata} markedQuestions={markedQuestions} submittedAnswers={submittedAnswers} userAnswers={userAnswers}
                    currentQuestionIndexBeforeReview={currentQuestionIndexBeforeReview} topicId={topicId}
                    onCloseReviewSummary={handleCloseReviewSummary}
                    onJumpToQuestionInQuiz={handleJumpToQuestion}
                    onEndQuiz={triggerFinishQuiz}
                    timerDisplayContent={timerDisplayComponent} dynamicFooterStyle={sharedFixedFooterStyle}
                />
            ) : (
                <>
                    <div className="quiz-header">
                        <div className="header-left">
                            {isPreviewMode ? (
                                <Link to="/" className="back-button-quiz icon-button">
                                    <FaChevronLeft /> Back to Home
                                </Link>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (isReviewMode) navigate(`/app/results/${topicId}/${sectionType}/${quizId}`);
                                        else navigate(`/app/topic/${topicId}`);
                                    }}
                                    className="back-button-quiz icon-button"
                                >
                                    <FaChevronLeft /> 
                                    {isReviewMode ? `Back to Results` : `Back to ${quizMetadata?.topicName || formatDisplayName(topicId)}`}
                                </button>
                            )}
                        </div>
                        <div className="header-center">
                            <h1 className="quiz-title">{quizMetadata?.fullNameForDisplay || 'Quiz'}</h1>
                        </div>
                        <div className="header-right">
                            <p className="quiz-progress">
                                Question {currentQuestionIndex + 1} of {totalQuestionsForDisplay} {isPreviewMode && '(Preview)'}
                            </p>
                        </div>
                    </div>
                    {passageHtml && topicId !== 'reading-comprehension' && (
                        <MemoizedPassage
                            html={passageContentKey && highlightedHtml[passageContentKey] !== undefined ? highlightedHtml[passageContentKey] : passageHtml}
                            passageRef={passageContainerRef}
                            data-content-key={passageContentKey}
                        />
                    )}
                    <div className="quiz-controls-top">
                        {(!isReviewMode && hasPracticeTestStarted) && (<div className="timer-display">{timerDisplayComponent}</div>)}
                        {(isReviewMode || !hasPracticeTestStarted) && <div className="timer-display-placeholder"></div>}
                    </div>
                    <div className="quiz-content-area">
                        {currentQuestionData && (
                            <QuestionCard
                                questionData={currentQuestionData} questionIndex={currentQuestionIndex} selectedOption={userAnswers[currentQuestionIndex]}
                                isSubmitted={cardIsSubmittedState} showExplanation={explanationContentShouldBeExpanded} crossedOffOptions={currentCrossedOffForCard}
                                userTimeSpentOnQuestion={userTimeSpent[currentQuestionIndex]} isReviewMode={isReviewMode} isMarked={currentIsMarkedForCard}
                                onOptionSelect={handleOptionSelect} onToggleExplanation={toggleExplanation} onToggleCrossOff={handleToggleCrossOff} onToggleMark={handleToggleMark}
                                isTemporarilyRevealed={!!tempReveal[currentQuestionIndex]} isPracticeTestActive={isPracticeTestActive}
                                highlightedHtml={highlightedHtml}
                            />
                        )}
                    </div>
                    {passageHtml && topicId === 'reading-comprehension' && (
                        <div className="passage-wrapper-below" style={{ marginTop: '20px' }}>
                            <MemoizedPassage
                                html={passageContentKey && highlightedHtml[passageContentKey] !== undefined ? highlightedHtml[passageContentKey] : passageHtml}
                                passageRef={passageContainerRef}
                                data-content-key={passageContentKey}
                            />
                        </div>
                    )}
                    <div className="quiz-navigation" style={sharedFixedFooterStyle}>
    <div className="nav-group-left">
        <button onClick={handlePrevious} disabled={!hasPracticeTestStarted || currentQuestionIndex === 0} className="nav-button prev-button"> Previous </button>
        {/* Hide Solution button in preview */}
        {sectionType === 'qbank' && !isReviewMode && !isPreviewMode && !isCurrentQuestionError && hasPracticeTestStarted && (
            <button onClick={toggleSolutionReveal} className="nav-button solution-toggle-button-bottom"> {tempReveal[currentQuestionIndex] ? "Hide Solution" : "'S' Solution"} </button>
        )}
    </div>
                        <div className="nav-group-center">
                            {isReviewMode && isLastQuestion ? (
                                <button onClick={triggerFinishQuiz} className="nav-button submit-quiz-button" disabled={!hasPracticeTestStarted}>
                                    Back to Results
                                </button>
                            ) : (
                                <button onClick={handleSubmitAndNavigate} className="nav-button next-button" disabled={!hasPracticeTestStarted || isCurrentQuestionError}>
                                    Next
                                </button>
                            )}
                        </div>
    <div className="nav-group-right">
        {/* Hide right-side controls in preview */}
        {!isReviewMode && !isPreviewMode && hasPracticeTestStarted && (
            <>
                {!isCurrentQuestionError && (
                    <button onClick={() => handleToggleMark(currentQuestionIndex)} className={`mark-button-nav ${currentIsMarkedForCard ? 'marked' : ''}`} title={currentIsMarkedForCard ? "Unmark this question" : "Mark for review"}>
                        {currentIsMarkedForCard ? '🚩 Unmark' : '🏳️ Mark'}
                    </button>
                )}
                {topicId === 'chemistry' && (
                    <button onClick={() => executeWithDelay(toggleExhibit, true)} className="nav-button exhibit-button">
                        Exhibit
                    </button>
                )}
                <button onClick={handleOpenReviewSummary} className="nav-button review-button-bottom">
                    Review
                </button>
            </>
        )}
    </div>
</div>
                </>
            )}
        </div>
    );
}

export default QuizPage;