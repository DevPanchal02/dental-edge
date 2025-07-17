
import React, { useState, useEffect, useRef } from 'react';
import '../styles/Exhibit.css';
import periodicTableImage from '../assets/periodic_table.png';

const Exhibit = ({ isVisible, onClose }) => {
    const [position, setPosition] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const exhibitRef = useRef(null);
    const initialPositionSetRef = useRef(false);

    // Helper to convert rem to pixels based on the root font size
    const getRemInPx = (rem) => {
        if (typeof window === 'undefined') return rem * 16; // Fallback for server-side rendering
        return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    };

    useEffect(() => {
        if (!isVisible) {
            setPosition(null);
            initialPositionSetRef.current = false;
        }
    }, [isVisible]);

    const handleImageLoad = () => {
        if (exhibitRef.current && !initialPositionSetRef.current) {
            const boundaryPx = getRemInPx(0.5); // The small boundary for dragging
            const spawnGapPx = getRemInPx(1.0);  // The larger gap for initial spawn
            const elemRect = exhibitRef.current.getBoundingClientRect();
            
            if (elemRect.width > 0 && elemRect.height > 0) {
                // Use the larger gap for the initial spawn position
                let initialX = window.innerWidth - elemRect.width - spawnGapPx;
                let initialY = window.innerHeight - elemRect.height - spawnGapPx;

                // Clamp the position to ensure it's still within the *actual* smaller boundary
                const minX = boundaryPx;
                const minY = boundaryPx;
                initialX = Math.max(minX, initialX);
                initialY = Math.max(minY, initialY);

                setPosition({ x: initialX, y: initialY });
                initialPositionSetRef.current = true;
            }
        }
    };

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('exhibit-close-btn-img')) {
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

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e) => {
        if (isDragging && exhibitRef.current) {
            const boundaryPx = getRemInPx(0.5); // Use the smaller 0.5rem for dragging
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
    };

    useEffect(() => {
        if (isDragging) {
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
    }, [isDragging, dragStart]);

    if (!isVisible) {
        return null;
    }

    const style = position
        ? { top: `${position.y}px`, left: `${position.x}px` }
        : { top: '-9999px', left: '-9999px', visibility: 'hidden' };

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
        </div>
    );
};

export default Exhibit;