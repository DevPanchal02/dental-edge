import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuizEngine } from '../hooks/useQuizEngine';
import { useLayout } from '../context/LayoutContext';
import { formatDisplayName } from '../services/loader';

// Components
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

// Types
import { SectionType } from '../types/content.types';

// --- TYPE DEFINITIONS ---

interface QuizPageProps {
    isPreviewMode?: boolean;
}

// Extending HTMLButtonElement to support the custom property '_selectionRange'
// This prevents the need for 'any' casting on the ref.
interface HighlightButtonElement extends HTMLButtonElement {
    _selectionRange?: Range | null;
}

/**
 * Typed Debounce Utility
 * Prevents rapid-fire execution of expensive DOM operations like selection calculation.
 */
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function(this: any, ...args: Parameters<T>) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}

const QuizPage: React.FC<QuizPageProps> = ({ isPreviewMode = false }) => {
    // We cast sectionType to SectionType because useParams returns string.
    // Ideally, we would validate this against a Zod schema or a guard function.
    const { topicId = '', sectionType = 'practice', quizId = '' } = useParams<{ 
        topicId: string; 
        sectionType: string; 
        quizId: string; 
    }>();
    
    const location = useLocation();
    const navigate = useNavigate();

    // Retrieve attemptId if we are entering Review Mode from the Results Page
    const reviewAttemptId = (location.state as { attemptId?: string })?.attemptId;

    const { state, actions } = useQuizEngine(
        topicId, 
        sectionType as SectionType, 
        quizId, 
        reviewAttemptId, 
        isPreviewMode
    );
    
    // Access Layout Context to adjust margins based on sidebar state (pinned vs floating)
    const { isSidebarEffectivelyPinned } = useLayout();
    
    // --- HIGHLIGHTER REFS & LOGIC ---
    const quizPageContainerRef = useRef<HTMLDivElement>(null);
    const highlightButtonRef = useRef<HighlightButtonElement>(null);
    
    // We create a ref for the passage even if we don't control its scroll here, 
    // because QuizContentArea requires a valid RefObject.
    const passageRef = useRef<HTMLDivElement>(null);

    const debouncedSelectionChangeHandlerRef = useRef<((event: Event) => void) | null>(null);

    /**
     * Handles the 'selectionchange' event.
     * Calculates the position of the selected text and positions the "Highlight" button accordingly.
     * Uses requestAnimationFrame for performance during layout recalculations.
     */
    const handleActualSelectionChange = useCallback(() => {
        // Guard Clause: Don't show highlight button if:
        // 1. We are currently saving (prevents UI jitter)
        // 2. We are navigating (state is unstable)
        // 3. Refs are not yet attached
        if (state.uiState.isSaving || 
            state.uiState.isNavActionInProgress || 
            !highlightButtonRef.current || 
            !quizPageContainerRef.current) {
             if (highlightButtonRef.current) highlightButtonRef.current.style.display = 'none';
             return;
        }

        requestAnimationFrame(() => {
            const selection = window.getSelection();
            
            // Basic checks: is there a selection, is it not empty
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().trim() === "") {
                if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }

            const range = selection.getRangeAt(0);
            
            // Check if selection is inside a valid content container (one with data-content-key)
            let commonAncestor: Node | null = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE && commonAncestor.parentNode) {
                commonAncestor = commonAncestor.parentNode;
            }
            
            // We use 'as Element' because closest() exists on Element, not Node
            const targetContainer = (commonAncestor as Element).closest('[data-content-key]');
            
            // Ensure refs are still valid inside the frame
            if (!quizPageContainerRef.current || !highlightButtonRef.current) return;

            if (targetContainer && range.toString().trim() !== "") {
                // USE getClientRects() to find the specific line where the selection ends
                const rects = range.getClientRects();
                // Fallback to bounding rect if rects is empty (rare)
                const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
                
                const containerRect = quizPageContainerRef.current.getBoundingClientRect();

                // Top: Bottom of the *last line* of selection + small gap + scroll offset
                const buttonTop = (rect.bottom - containerRect.top) + quizPageContainerRef.current.scrollTop + 5;
                
                // Left: Right of the *last line* of selection + scroll offset
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

    // Setup and Teardown of the Selection Event Listener
    useEffect(() => {
        // We cast the event to 'any' for the debounce generic, then type strict inside
        debouncedSelectionChangeHandlerRef.current = debounce(handleActualSelectionChange, 150) as (event: Event) => void;
        
        document.addEventListener('selectionchange', debouncedSelectionChangeHandlerRef.current);
        return () => { 
            if (debouncedSelectionChangeHandlerRef.current) {
                document.removeEventListener('selectionchange', debouncedSelectionChangeHandlerRef.current); 
            }
        };
    }, [handleActualSelectionChange]);

    /**
     * Executed when the user clicks the floating "Highlight" button.
     * Wraps the selected text in <mark> tags and updates the reducer state.
     */
    const toggleHighlight = useCallback(() => {
        if (!highlightButtonRef.current || !highlightButtonRef.current._selectionRange) return;
        
        const range = highlightButtonRef.current._selectionRange;
        let container: Node | null = range.commonAncestorContainer;
        
        // Find the main content container (Passage, Question, etc.)
        // We need this to save the HTML later.
        if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
            container = container.parentNode;
        }
        
        const dataContentContainer = (container as Element).closest('[data-content-key]') as HTMLElement;

        if (!dataContentContainer || !dataContentContainer.dataset.contentKey) {
             highlightButtonRef.current.style.display = 'none';
             return;
        }

        const highlightGroupId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const nodesToWrap: Node[] = [];

        // CASE 1: Simple selection (Single Text Node)
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
            const parent = node.parentNode as HTMLElement;

            // Prevent double-wrapping if already highlighted
            if (parent && parent.tagName === 'MARK' && parent.classList.contains('custom-highlight')) {
                continue; 
            }

            let start = 0;
            let end = node.nodeValue ? node.nodeValue.length : 0;

            if (node === range.startContainer) {
                start = range.startOffset;
            }
            if (node === range.endContainer) {
                end = range.endOffset;
            }

            if (start >= end) continue;

            const text = node.nodeValue || '';
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
            
            if (node.parentNode) {
                node.parentNode.replaceChild(fragment, node);
            }
        }

        // Merge adjacent text nodes to keep HTML clean
        dataContentContainer.normalize();

        // Save the updated HTML
        actions.updateHighlight(dataContentContainer.dataset.contentKey, dataContentContainer.innerHTML);
        
        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        window.getSelection()?.removeAllRanges();
    }, [actions]);

    /**
     * Handles clicks on the container to detect if a Highlight should be REMOVED.
     */
    const handleContainerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const clickedElement = event.target as HTMLElement;
        
        // Ignore clicks on the highlight button itself
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) return;

        const markElement = clickedElement.closest('mark.custom-highlight') as HTMLElement;
        const containerWithKey = clickedElement.closest('[data-content-key]') as HTMLElement;

        if (markElement && containerWithKey) {
            // Check if this mark has a group ID
            const groupId = markElement.dataset.highlightGroup;
            let marksToRemove = [markElement];

            // If it has a group ID, find ALL marks with that ID in this container
            if (groupId) {
                const groupMarks = containerWithKey.querySelectorAll(`mark.custom-highlight[data-highlight-group="${groupId}"]`);
                marksToRemove = Array.from(groupMarks) as HTMLElement[];
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
            window.getSelection()?.removeAllRanges();
            event.stopPropagation();
        } else {
             // Hide the button if clicking elsewhere
             if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) {
                    highlightButtonRef.current.style.display = 'none';
                }
             }
        }
    }, [actions]);

    // --- END HIGHLIGHTER LOGIC ---

    // Memoize the current question to prevent downstream re-renders
    const currentQuestion = useMemo(() => {
        return state.quizContent.questions[state.attempt.currentQuestionIndex] || null;
    }, [state.quizContent.questions, state.attempt.currentQuestionIndex]);

    // Calculate props for child components
    // We group these to keep the return statement clean and readable
    const uiProps = useMemo(() => {
        const isPractice = state.quizIdentifiers?.sectionType === 'practice';
        const isReviewing = state.status === 'reviewing_attempt';
        const currentIndex = state.attempt.currentQuestionIndex;

        // In preview mode, we might want to pretend there are more questions for marketing
        const displayQuestionCount = isPreviewMode ? 210 : state.quizContent.questions.length;

        return {
            containerStyle: {
                marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
                paddingBottom: '90px',
            } as React.CSSProperties,
            footerStyle: {
                left: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
                width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
            } as React.CSSProperties,
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
                // --- FIX: Added isMarked back to satisfy QuizContentAreaProps ---
                isMarked: !!state.attempt.markedQuestions[currentIndex],
                // Logic: Show submitted state if it's practice and submitted, OR if qbank/review and submitted/revealed
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
                passageContainerRef: passageRef, // PASS THE REF HERE
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

    // --- RENDER PHASES ---

    if (state.status === 'initializing' || state.status === 'loading') {
        return <LoadingSpinner message="Loading Quiz..." />;
    }

    if (state.status === 'error') {
        return <ErrorDisplay 
            error={state.error?.message || 'An unknown error occurred.'} 
            backLink={isPreviewMode ? '/' : `/app/topic/${topicId}`} 
            backLinkText={isPreviewMode ? 'Back to Home' : 'Back to Topic'} 
        />;
    }
    
    if (state.status === 'prompting_options') {
        return (
            <PracticeTestOptions
                isOpen={true}
                onClose={() => navigate('/')}
                onStartTest={actions.startAttemptWithOptions}
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
    
    const formatTime = (totalSeconds: number) => {
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