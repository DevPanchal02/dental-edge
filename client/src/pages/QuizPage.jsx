import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { formatDisplayName } from '../services/loader.js';

import QuizHeader from '../components/quiz/QuizHeader';
import QuizFooter from '../components/quiz/QuizFooter';
import QuizContentArea from '../components/quiz/QuizContentArea';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import ResumePromptModal from '../components/ResumePromptModal';
import QuizReviewSummary from '../components/QuizReviewSummary';
import PracticeTestOptions from '../components/PracticeTestOptions';
import RegistrationPromptModal from '../components/RegistrationPromptModal';
import Exhibit from '../components/Exhibit';

// Debounce utility for selection events
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}

function QuizPage({ isPreviewMode = false }) {
    const { topicId, sectionType, quizId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const reviewAttemptId = location.state?.attemptId;

    const { state, actions } = useQuizEngine(topicId, sectionType, quizId, reviewAttemptId, isPreviewMode);
    
    // --- FIX: Unconditional Hook Call ---
    // This is now safe because App.jsx wraps this component in a Provider
    // even during preview mode.
    const { isSidebarEffectivelyPinned } = useLayout();
    
    // --- HIGHLIGHTER REFS & LOGIC ---
    const quizPageContainerRef = useRef(null);
    const highlightButtonRef = useRef(null);
    const debouncedSelectionChangeHandlerRef = useRef(null);

    const handleActualSelectionChange = useCallback(() => {
        // Don't show highlight button if dragging exhibit or doing other nav actions
        if (state.uiState.isSaving || state.uiState.isNavActionInProgress || !highlightButtonRef.current || !quizPageContainerRef.current) {
             if (highlightButtonRef.current) highlightButtonRef.current.style.display = 'none';
             return;
        }

        requestAnimationFrame(() => {
            const selection = window.getSelection();
            
            // Basic checks: is there a selection, is it not empty
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().trim() === "") {
                if (highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }

            const range = selection.getRangeAt(0);
            
            // Check if selection is inside a valid content container
            let commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE) commonAncestor = commonAncestor.parentNode;
            
            const targetContainer = commonAncestor.closest('[data-content-key]');
            
            if (targetContainer && range.toString().trim() !== "") {
                // USE getClientRects() to find the specific line where the selection ends
                const rects = range.getClientRects();
                // Fallback to bounding rect if rects is empty (rare)
                const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
                
                const containerRect = quizPageContainerRef.current.getBoundingClientRect();

                // Top: Bottom of the *last line* of selection + small gap
                const buttonTop = (rect.bottom - containerRect.top) + quizPageContainerRef.current.scrollTop + 5;
                
                // Left: Right of the *last line* of selection
                // This ensures it follows the cursor at the end of the text
                const buttonLeft = (rect.right - containerRect.left) + quizPageContainerRef.current.scrollLeft;
                
                highlightButtonRef.current.style.position = 'absolute';
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
    }, [state.uiState.isSaving, state.uiState.isNavActionInProgress]);

    useEffect(() => {
        debouncedSelectionChangeHandlerRef.current = debounce(handleActualSelectionChange, 150);
        document.addEventListener('selectionchange', debouncedSelectionChangeHandlerRef.current);
        return () => { 
            if (debouncedSelectionChangeHandlerRef.current) {
                document.removeEventListener('selectionchange', debouncedSelectionChangeHandlerRef.current); 
            }
        };
    }, [handleActualSelectionChange]);

    const toggleHighlight = useCallback(() => {
        if (!highlightButtonRef.current || !highlightButtonRef.current._selectionRange) return;
        
        const range = highlightButtonRef.current._selectionRange;
        let container = range.commonAncestorContainer;
        
        // Find the main content container (Passage, Question, etc.)
        // We need this to save the HTML later.
        let dataContentContainer = container;
        if (dataContentContainer.nodeType === Node.TEXT_NODE) {
            dataContentContainer = dataContentContainer.parentNode;
        }
        dataContentContainer = dataContentContainer.closest('[data-content-key]');

        if (!dataContentContainer || !dataContentContainer.dataset.contentKey) {
             highlightButtonRef.current.style.display = 'none';
             return;
        }

        const highlightGroupId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const nodesToWrap = [];

        // CASE 1: Simple selection (Single Text Node)
        // TreeWalker fails here because it looks for children, and TextNodes have none.
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
            nodesToWrap.push(range.commonAncestorContainer);
        } 
        // CASE 2: Complex selection (Spans multiple nodes/tags)
        else {
            const treeWalker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            let currentNode = treeWalker.nextNode();
            while (currentNode) {
                nodesToWrap.push(currentNode);
                currentNode = treeWalker.nextNode();
            }
        }

        if (nodesToWrap.length === 0) {
             highlightButtonRef.current.style.display = 'none';
             return;
        }

        // Process in reverse order to keep offsets valid while modifying DOM
        for (let i = nodesToWrap.length - 1; i >= 0; i--) {
            const node = nodesToWrap[i];
            
            // Prevent double-wrapping if already highlighted
            if (node.parentNode.tagName === 'MARK' && node.parentNode.classList.contains('custom-highlight')) {
                continue; 
            }

            let start = 0;
            let end = node.nodeValue.length;

            if (node === range.startContainer) {
                start = range.startOffset;
            }
            if (node === range.endContainer) {
                end = range.endOffset;
            }

            if (start >= end) continue;

            const text = node.nodeValue;
            const beforeText = text.substring(0, start);
            const selectedText = text.substring(start, end);
            const afterText = text.substring(end);

            const mark = document.createElement('mark');
            mark.className = 'custom-highlight';
            mark.textContent = selectedText;
            mark.dataset.highlightGroup = highlightGroupId;

            const fragment = document.createDocumentFragment();
            if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
            fragment.appendChild(mark);
            if (afterText) fragment.appendChild(document.createTextNode(afterText));
            
            node.parentNode.replaceChild(fragment, node);
        }

        // Merge adjacent text nodes to keep HTML clean
        dataContentContainer.normalize();

        // Save the updated HTML
        actions.updateHighlight(dataContentContainer.dataset.contentKey, dataContentContainer.innerHTML);
        
        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        window.getSelection().removeAllRanges();
    }, [actions]);

    const handleContainerClick = useCallback((event) => {
        const clickedElement = event.target;
        
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) return;

        const markElement = clickedElement.closest('mark.custom-highlight');
        const containerWithKey = clickedElement.closest('[data-content-key]');

        if (markElement && containerWithKey) {
            // Check if this mark has a group ID
            const groupId = markElement.dataset.highlightGroup;
            let marksToRemove = [markElement];

            // If it has a group ID, find ALL marks with that ID in this container
            if (groupId) {
                const groupMarks = containerWithKey.querySelectorAll(`mark.custom-highlight[data-highlight-group="${groupId}"]`);
                marksToRemove = Array.from(groupMarks);
            }

            // Remove all identified marks
            marksToRemove.forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
                    parent.removeChild(mark);
                    parent.normalize();
                }
            });

            // Save new state
            if (containerWithKey.dataset.contentKey) {
                actions.updateHighlight(containerWithKey.dataset.contentKey, containerWithKey.innerHTML);
            }
            
            if (highlightButtonRef.current) {
                highlightButtonRef.current.style.display = 'none';
                highlightButtonRef.current._selectionRange = null;
            }
            window.getSelection().removeAllRanges();
            event.stopPropagation();
        } else {
             if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) {
                    highlightButtonRef.current.style.display = 'none';
                }
             }
        }
    }, [actions]);

    // --- END HIGHLIGHTER LOGIC ---

    const currentQuestion = useMemo(() => {
        return state.quizContent.questions[state.attempt.currentQuestionIndex] || null;
    }, [state.quizContent.questions, state.attempt.currentQuestionIndex]);

    const uiProps = useMemo(() => {
        const isPractice = state.quizIdentifiers?.sectionType === 'practice';
        const isReviewing = state.status === 'reviewing_attempt';
        const currentIndex = state.attempt.currentQuestionIndex;

        const displayQuestionCount = isPreviewMode ? 210 : state.quizContent.questions.length;

        return {
            containerStyle: {
                marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
                paddingBottom: '90px',
            },
            footerStyle: {
                left: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
            },
            headerProps: {
                title: state.quizContent.metadata?.fullNameForDisplay || 'Loading Quiz...',
                progressText: `Question ${currentIndex + 1} of ${displayQuestionCount}`,
                backLink: isReviewing ? `/app/results/${topicId}/${sectionType}/${quizId}` : `/app/topic/${topicId}`,
                backText: isReviewing ? 'Back to Results' : `Back to ${state.quizContent.metadata?.topicName || formatDisplayName(topicId)}`,
                isPreviewMode: isPreviewMode,
            },
            contentAreaProps: {
                currentQuestion: currentQuestion,
                passageHtml: currentQuestion?.passage?.html_content,
                highlightedHtml: state.attempt.highlightedHtml, 
                topicId: topicId,
                questionIndex: currentIndex,
                userAnswer: state.attempt.userAnswers[currentIndex],
                crossedOffOptions: state.attempt.crossedOffOptions,
                isMarked: !!state.attempt.markedQuestions[currentIndex],
                isSubmitted: (isPractice && !!state.attempt.submittedAnswers?.[currentIndex]) || (!isPractice && (!!state.attempt.submittedAnswers?.[currentIndex] || isReviewing || !!state.uiState.tempReveal[currentIndex])),
                isReviewMode: isReviewing,
                isTemporarilyRevealed: !!state.uiState.tempReveal[currentIndex],
                isPracticeTestActive: isPractice && !isReviewing,
                showExplanation: !!state.uiState.showExplanation[currentIndex],
                timeSpent: state.attempt.userTimeSpent[currentIndex],
                timerValue: state.timer.value,
                isCountdown: state.timer.isCountdown,
                initialDuration: state.timer.initialDuration,
                hasStarted: state.status === 'active' || isReviewing,
                onOptionSelect: actions.selectOption,
                onToggleExplanation: actions.toggleExplanation,
                onToggleCrossOff: actions.toggleCrossOff,
                onToggleMark: actions.toggleMark,
            },
            footerProps: {
                onNext: actions.nextQuestion,
                onPrevious: actions.previousQuestion,
                onMark: actions.toggleMark,
                onReview: actions.openReviewSummary,
                onToggleExhibit: actions.toggleExhibit,
                onToggleSolution: actions.toggleSolution,
                isFirstQuestion: currentIndex === 0,
                isLastQuestion: currentIndex === state.quizContent.questions.length - 1,
                isMarked: !!state.attempt.markedQuestions[currentIndex],
                isSaving: state.uiState.isSaving,
                isReviewMode: isReviewing,
                hasStarted: state.status === 'active' || isReviewing,
                showExhibitButton: topicId === 'chemistry',
                showSolutionButton: state.quizIdentifiers?.sectionType === 'qbank',
                solutionVisible: !!state.uiState.tempReveal[currentIndex],
            },
        };
    }, [state, actions, isSidebarEffectivelyPinned, topicId, sectionType, quizId, isPreviewMode, currentQuestion]);

    if (state.status === 'initializing' || state.status === 'loading') {
        return <LoadingSpinner message="Loading Quiz..." />;
    }

    if (state.status === 'error') {
        return <ErrorDisplay error={state.error?.message || 'An unknown error occurred.'} backLink={isPreviewMode ? '/' : `/app/topic/${topicId}`} backLinkText={isPreviewMode ? 'Back to Home' : 'Back to Topic'} />;
    }
    
    if (state.status === 'prompting_options') {
        return (
            <PracticeTestOptions
                isOpen={true}
                onClose={() => navigate('/')}
                onStartTest={actions.startPreview}
                fullNameForDisplay={state.quizContent.metadata?.fullNameForDisplay}
                categoryForInstructions={state.quizContent.metadata?.categoryForInstructions}
                baseTimeLimitMinutes={180}
                numQuestions={210} 
            />
        );
    }
    
    if (state.status === 'prompting_registration') {
        return <RegistrationPromptModal isOpen={true} onClose={actions.closeRegistrationPrompt} />;
    }

    if (state.status === 'prompting_resume' && !isPreviewMode) {
        return (
            <ResumePromptModal
                onResume={actions.resumeAttempt}
                onStartNew={actions.startNewAttempt}
            />
        );
    }
    
    const formatTime = (totalSeconds) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div 
            className={`quiz-page-container ${isPreviewMode ? 'preview-mode' : ''}`} 
            style={uiProps.containerStyle}
            ref={quizPageContainerRef}
            onClick={handleContainerClick} // Attach click handler for removing highlights
        >
            {/* Highlight Button Popup */}
            <button 
                ref={highlightButtonRef} 
                className="highlight-popup-button" 
                style={{ display: 'none', position: 'absolute', zIndex: 2000 }} 
                onClick={toggleHighlight} 
                onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
            > 
                Highlight 
            </button>

            {state.status === 'reviewing_summary' ? (
                <QuizReviewSummary
                    allQuizQuestions={state.quizContent.questions}
                    quizMetadata={state.quizContent.metadata}
                    markedQuestions={state.attempt.markedQuestions}
                    submittedAnswers={state.attempt.submittedAnswers || {}}
                    userAnswers={state.attempt.userAnswers}
                    currentQuestionIndexBeforeReview={state.attempt.currentQuestionIndex}
                    topicId={topicId}
                    onCloseReviewSummary={actions.closeReviewSummary}
                    onJumpToQuestionInQuiz={actions.jumpToQuestion}
                    onEndQuiz={actions.finalizeAttempt}
                    timerDisplayContent={`${state.timer.isCountdown ? 'Time Left' : 'Time Elapsed'}: ${formatTime(state.timer.value)}`}
                    dynamicFooterStyle={uiProps.footerStyle}
                    isNavActionInProgress={state.uiState.isSaving}
                />
            ) : (
                (state.status === 'active' || state.status === 'reviewing_attempt') && (
                    <>
                        <QuizHeader {...uiProps.headerProps} />
                        <QuizContentArea {...uiProps.contentAreaProps} />
                        <QuizFooter 
                            {...uiProps.footerProps} 
                            isSaving={state.uiState.isSaving} 
                            dynamicStyle={uiProps.footerStyle} 
                        />
                        <Exhibit 
                            isVisible={state.uiState.isExhibitVisible} 
                            onClose={actions.toggleExhibit} 
                        />
                    </>
                )
            )}
        </div>
    );
}

export default QuizPage;