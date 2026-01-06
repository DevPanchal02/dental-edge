import React, { useState, useEffect, useRef } from 'react';
import '../styles/Exhibit.css';
import periodicTableImage from '../assets/periodic_table.png';

const Exhibit = ({ isVisible, onClose }) => {
    const [position, setPosition] = useState(null);
    const [size, setSize] = useState({ width: 510 }); // Default width
    
    // Dragging State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Resizing State
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, width: 0 });

    const exhibitRef = useRef(null);
    const initialPositionSetRef = useRef(false);

    // Helper to convert rem to pixels based on the root font size
    const getRemInPx = (rem) => {
        if (typeof window === 'undefined') return rem * 16;
        return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    };

    useEffect(() => {
        if (!isVisible) {
            setPosition(null);
            initialPositionSetRef.current = false;
            // Reset size on close if desired, or keep it persistent
            // setSize({ width: 510 }); 
        }
    }, [isVisible]);

    const handleImageLoad = () => {
        if (exhibitRef.current && !initialPositionSetRef.current) {
            const boundaryPx = getRemInPx(0.5);
            const spawnGapPx = getRemInPx(1.0);
            const elemRect = exhibitRef.current.getBoundingClientRect();
            
            if (elemRect.width > 0 && elemRect.height > 0) {
                let initialX = window.innerWidth - elemRect.width - spawnGapPx;
                let initialY = window.innerHeight - elemRect.height - spawnGapPx;

                const minX = boundaryPx;
                const minY = boundaryPx;
                initialX = Math.max(minX, initialX);
                initialY = Math.max(minY, initialY);

                setPosition({ x: initialX, y: initialY });
                initialPositionSetRef.current = true;
            }
        }
    };

    // --- Drag Logic ---
    const handleMouseDown = (e) => {
        // Prevent drag if clicking close button, resizer, or inside content if needed
        if (
            e.target.classList.contains('exhibit-close-btn-img') || 
            e.target.classList.contains('exhibit-resizer')
        ) {
            return;
        }
        
        setIsDragging(true);
        const exhibitRect = exhibitRef.current.getBoundingClientRect();
        setDragStart({
            x: e.clientX - exhibitRect.left,
            y: e.clientY - exhibitRect.top,
        });
        e.preventDefault();
    };

    // --- Resize Logic ---
    const handleResizeMouseDown = (e) => {
        e.stopPropagation(); // Prevent triggering the drag
        e.preventDefault();
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            width: size.width
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    const handleMouseMove = (e) => {
        if (isDragging && exhibitRef.current) {
            const boundaryPx = getRemInPx(0.5);
            const { width, height } = exhibitRef.current.getBoundingClientRect();

            let newX = e.clientX - dragStart.x;
            let newY = e.clientY - dragStart.y;

            const minX = boundaryPx;
            const minY = boundaryPx;
            const maxX = window.innerWidth - width - boundaryPx;
            const maxY = window.innerHeight - height - boundaryPx;

            const clampedX = Math.max(minX, Math.min(newX, maxX));
            const clampedY = Math.max(minY, Math.min(newY, maxY));

            setPosition({ x: clampedX, y: clampedY });
        }

        if (isResizing) {
            const deltaX = e.clientX - resizeStart.x;
            const newWidth = Math.max(200, resizeStart.width + deltaX); // Min width 200px
            const maxWidth = window.innerWidth - 50; // Prevent making it wider than screen
            
            setSize({ width: Math.min(newWidth, maxWidth) });
        }
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragStart, resizeStart]);

    if (!isVisible) {
        return null;
    }

    const style = position
        ? { top: `${position.y}px`, left: `${position.x}px`, width: `${size.width}px` }
        : { top: '-9999px', left: '-9999px', visibility: 'hidden', width: `${size.width}px` };

    return (
        <div
            ref={exhibitRef}
            className="exhibit-container"
            style={style}
            onMouseDown={handleMouseDown}
        >
            <button
                onClick={onClose}
                className="exhibit-close-btn-img"
                aria-label="Close Exhibit"
                onMouseDown={(e) => e.stopPropagation()}
            >
                ×
            </button>
            
            <img 
                src={periodicTableImage} 
                alt="Periodic Table of Elements" 
                onLoad={handleImageLoad}
            />

            {/* Resize Handle */}
            <div 
                className="exhibit-resizer"
                onMouseDown={handleResizeMouseDown}
            ></div>
        </div>
    );
};

export default Exhibit;
