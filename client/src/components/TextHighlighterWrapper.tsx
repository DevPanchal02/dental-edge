import React, { useRef, useEffect, useCallback, useState } from 'react';
import '../styles/TextHighlighterWrapper.css';

interface TextHighlighterWrapperProps {
    children: React.ReactNode;
    onHighlightUpdate: (contentKey: string, newHtml: string) => void;
    isEnabled: boolean;
    className?: string;
}

// Extending HTMLButtonElement to support the custom property '_selectionRange'
interface HighlightButtonElement extends HTMLButtonElement {
    _selectionRange?: Range | null;
}

/**
 * Debounce Utility
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

const TextHighlighterWrapper: React.FC<TextHighlighterWrapperProps> = ({ 
    children, 
    onHighlightUpdate, 
    isEnabled,
    className 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const highlightButtonRef = useRef<HighlightButtonElement>(null);
    const [isButtonVisible, setIsButtonVisible] = useState(false);

    /**
     * Calculates position of selected text and positions the floating button.
     */
    const handleSelectionChange = useCallback(() => {
        if (!isEnabled || !containerRef.current || !highlightButtonRef.current) {
            if (isButtonVisible) setIsButtonVisible(false);
            return;
        }

        requestAnimationFrame(() => {
            const selection = window.getSelection();
            
            // Validation: Must have selection, not collapsed, not empty
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().trim() === "") {
                if (highlightButtonRef.current) {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
                return;
            }

            const range = selection.getRangeAt(0);
            
            // Validation: Selection must be inside a container with 'data-content-key'
            let commonAncestor: Node | null = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE && commonAncestor.parentNode) {
                commonAncestor = commonAncestor.parentNode;
            }
            const targetContainer = (commonAncestor as Element).closest('[data-content-key]');
            
            // Validation: Ensure the selection is actually inside OUR wrapper
            if (!containerRef.current?.contains(targetContainer)) {
                 return;
            }

            if (targetContainer && range.toString().trim() !== "") {
                const rects = range.getClientRects();
                const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();

                // Calculate relative position inside the wrapper
                // We use the wrapper's scrollTop/Left to handle scrolling correctly
                const buttonTop = (rect.bottom - containerRect.top) + containerRef.current.scrollTop + 5;
                const buttonLeft = (rect.right - containerRect.left) + containerRef.current.scrollLeft;
                
                if (highlightButtonRef.current) {
                    highlightButtonRef.current.style.position = 'absolute';
                    highlightButtonRef.current.style.top = `${buttonTop}px`;
                    highlightButtonRef.current.style.left = `${buttonLeft}px`;
                    highlightButtonRef.current.style.display = 'block';
                    highlightButtonRef.current._selectionRange = range.cloneRange();
                }
            } else {
                if (highlightButtonRef.current) {
                    highlightButtonRef.current.style.display = 'none';
                    highlightButtonRef.current._selectionRange = null;
                }
            }
        });
    }, [isEnabled, isButtonVisible]);

    // Attach listeners
    useEffect(() => {
        const debouncedHandler = debounce(handleSelectionChange, 150) as (event: Event) => void;
        document.addEventListener('selectionchange', debouncedHandler);
        
        // Hide button on scroll to prevent misalignment
        const handleScroll = () => {
             if (highlightButtonRef.current) highlightButtonRef.current.style.display = 'none';
        };
        window.addEventListener('scroll', handleScroll, true); 

        return () => { 
            document.removeEventListener('selectionchange', debouncedHandler);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [handleSelectionChange]);

    /**
     * Applies the highlight wrapping logic.
     */
    const applyHighlight = useCallback(() => {
        if (!highlightButtonRef.current || !highlightButtonRef.current._selectionRange) return;
        
        const range = highlightButtonRef.current._selectionRange;
        let container: Node | null = range.commonAncestorContainer;
        
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

        // Identify nodes
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
            nodesToWrap.push(range.commonAncestorContainer);
        } else {
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

        // Apply wrapping
        for (let i = nodesToWrap.length - 1; i >= 0; i--) {
            const node = nodesToWrap[i];
            const parent = node.parentNode as HTMLElement;

            // Prevent double-wrapping
            if (parent && parent.tagName === 'MARK' && parent.classList.contains('custom-highlight')) {
                continue; 
            }

            let start = 0;
            let end = node.nodeValue ? node.nodeValue.length : 0;

            if (node === range.startContainer) start = range.startOffset;
            if (node === range.endContainer) end = range.endOffset;

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

        // Normalize and Update
        dataContentContainer.normalize();
        onHighlightUpdate(dataContentContainer.dataset.contentKey, dataContentContainer.innerHTML);
        
        // Reset UI
        highlightButtonRef.current.style.display = 'none';
        highlightButtonRef.current._selectionRange = null;
        window.getSelection()?.removeAllRanges();

    }, [onHighlightUpdate]);

    /**
     * Handles clicks to remove highlights.
     */
    const handleWrapperClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const clickedElement = event.target as HTMLElement;
        
        // Ignore button clicks
        if (highlightButtonRef.current && highlightButtonRef.current.contains(clickedElement)) return;

        const markElement = clickedElement.closest('mark.custom-highlight') as HTMLElement;
        const containerWithKey = clickedElement.closest('[data-content-key]') as HTMLElement;

        if (markElement && containerWithKey) {
            // Remove Logic
            const groupId = markElement.dataset.highlightGroup;
            let marksToRemove = [markElement];

            if (groupId) {
                const groupMarks = containerWithKey.querySelectorAll(`mark.custom-highlight[data-highlight-group="${groupId}"]`);
                marksToRemove = Array.from(groupMarks) as HTMLElement[];
            }

            marksToRemove.forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
                    parent.removeChild(mark);
                    parent.normalize();
                }
            });

            if (containerWithKey.dataset.contentKey) {
                onHighlightUpdate(containerWithKey.dataset.contentKey, containerWithKey.innerHTML);
            }
            
            // Hide button if open
            if (highlightButtonRef.current) {
                highlightButtonRef.current.style.display = 'none';
                highlightButtonRef.current._selectionRange = null;
            }
            window.getSelection()?.removeAllRanges();
            event.stopPropagation();
        } else {
             // Clicked outside highlight - just hide button if selection cleared
             if (highlightButtonRef.current && highlightButtonRef.current.style.display === 'block') {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) {
                    highlightButtonRef.current.style.display = 'none';
                }
             }
        }
    }, [onHighlightUpdate]);

    return (
        <div 
            ref={containerRef} 
            className={`text-highlighter-wrapper ${className || ''}`}
            onClick={handleWrapperClick}
        >
            <button 
                ref={highlightButtonRef} 
                className="highlight-popup-button" 
                onClick={(e) => { e.stopPropagation(); applyHighlight(); }}
                onMouseDown={(e) => e.preventDefault()} 
            > 
                Highlight 
            </button>
            {children}
        </div>
    );
};

export default TextHighlighterWrapper;