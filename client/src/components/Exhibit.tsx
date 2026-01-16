import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Exhibit.css';
import periodicTableImage from '../assets/periodic_table.png';

interface ExhibitProps {
    isVisible: boolean;
    onClose: () => void;
}

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
}

interface DragStart {
    x: number;
    y: number;
}

interface ResizeStart {
    x: number;
    width: number;
}

const Exhibit: React.FC<ExhibitProps> = ({ isVisible, onClose }) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [size, setSize] = useState<Size>({ width: 510 }); 
    
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<DragStart>({ x: 0, y: 0 });
    
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const [resizeStart, setResizeStart] = useState<ResizeStart>({ x: 0, width: 0 });

    const exhibitRef = useRef<HTMLDivElement>(null);
    const initialPositionSetRef = useRef<boolean>(false);

    const getRemInPx = (rem: number): number => {
        if (typeof window === 'undefined') return rem * 16;
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

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        
        // Check if the click target is the close button or resizer
        if (
            target.classList.contains('exhibit-close-btn-img') || 
            target.classList.contains('exhibit-resizer')
        ) {
            return;
        }
        
        if (exhibitRef.current) {
            setIsDragging(true);
            const exhibitRect = exhibitRef.current.getBoundingClientRect();
            setDragStart({
                x: e.clientX - exhibitRect.left,
                y: e.clientY - exhibitRect.top,
            });
            e.preventDefault();
        }
    };

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            width: size.width
        });
    };

    // Note: These are Native DOM Event Listeners (window), not React Synthetic Events
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging && exhibitRef.current) {
            const boundaryPx = getRemInPx(0.5);
            const { width, height } = exhibitRef.current.getBoundingClientRect();

            // Calculate raw new position
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;

            // Constrain to window boundaries
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
            const newWidth = Math.max(200, resizeStart.width + deltaX); 
            const maxWidth = window.innerWidth - 50; 
            
            setSize({ width: Math.min(newWidth, maxWidth) });
        }
    }, [isDragging, isResizing, dragStart, resizeStart]); 

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
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    if (!isVisible) {
        return null;
    }

    const style: React.CSSProperties = position
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

            <div 
                className="exhibit-resizer"
                onMouseDown={handleResizeMouseDown}
            ></div>
        </div>
    );
};

export default Exhibit;