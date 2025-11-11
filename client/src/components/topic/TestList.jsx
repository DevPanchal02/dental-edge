// FILE: client/src/components/topic/TestList.jsx

import React from 'react';
import { FaLock, FaChevronRight } from 'react-icons/fa';
import '../../styles/TestList.css'; // <-- Import the new stylesheet

function TestList({ items, selectedItemId, onItemSelect, onStartQuiz, onLockedItemClick, userProfile }) {
    
    const isLocked = (index) => {
        if (!userProfile) return true;
        if (userProfile.tier === 'pro' || userProfile.tier === 'plus') return false;
        if (userProfile.tier === 'free') return index > 0;
        return true;
    };

    if (!items || items.length === 0) {
        return <p className="no-items-message">No items available for this section.</p>;
    }

    const handleItemClick = (item, isLocked) => {
        if (isLocked) {
            onLockedItemClick();
            return;
        }
        if (item.id === selectedItemId) {
            onStartQuiz(item.id, item.sectionType);
        } else {
            onItemSelect(item.id, item.sectionType);
        }
    };

    const handleItemDoubleClick = (item, isLocked) => {
        if (isLocked) {
            onLockedItemClick();
            return;
        }
        onStartQuiz(item.id, item.sectionType);
    };

    const handleArrowClick = (e, item, isLocked) => {
        e.stopPropagation();
        if (isLocked) {
            onLockedItemClick();
            return;
        }
        onStartQuiz(item.id, item.sectionType);
    };

    return (
        <div className="item-list">
            {items.map((item, index) => {
                const locked = isLocked(index);
                const isSelected = item.id === selectedItemId;

                return (
                    <div 
                        key={item.id} 
                        className={`list-item ${locked ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemClick(item, locked)}
                        onDoubleClick={() => handleItemDoubleClick(item, locked)}
                    >
                        <div className="item-link">
                            <span className="item-name">{item.name}</span>
                            <span 
                                className="item-indicator"
                                onClick={(e) => handleArrowClick(e, item, locked)}
                            >
                                {locked ? <FaLock /> : <FaChevronRight />}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default TestList;