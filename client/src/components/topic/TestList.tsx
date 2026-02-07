import React from 'react';
import { FaLock, FaChevronRight } from 'react-icons/fa';
import '../../styles/TestList.css';
import { QuizItem, SectionType } from '../../types/content.types';
import { UserProfile } from '../../types/user.types';

interface TestListProps {
    items: QuizItem[] | undefined;
    selectedItemId: string | null;
    onItemSelect: (id: string, type: SectionType) => void;
    onStartQuiz: (id: string, type: SectionType) => void;
    onLockedItemClick: () => void;
    userProfile: UserProfile | null;
}

const TestList: React.FC<TestListProps> = ({ 
    items, 
    selectedItemId, 
    onItemSelect, 
    onStartQuiz, 
    onLockedItemClick, 
    userProfile 
}) => {
    
    const isLocked = (index: number) => {
        if (!userProfile) return true;
        if (userProfile.tier === 'pro' || userProfile.tier === 'plus') return false;
        if (userProfile.tier === 'free') return index > 0;
        return true;
    };

    if (!items || items.length === 0) {
        return <p className="no-items-message">No items available for this section.</p>;
    }

    const handleItemClick = (item: QuizItem, locked: boolean) => {
        if (locked) {
            onLockedItemClick();
            return;
        }
        if (item.id === selectedItemId) {
            onStartQuiz(item.id, item.sectionType);
        } else {
            onItemSelect(item.id, item.sectionType);
        }
    };

    const handleItemDoubleClick = (item: QuizItem, locked: boolean) => {
        if (locked) {
            onLockedItemClick();
            return;
        }
        onStartQuiz(item.id, item.sectionType);
    };

    const handleArrowClick = (e: React.MouseEvent, item: QuizItem, locked: boolean) => {
        e.stopPropagation();
        if (locked) {
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
};

export default React.memo(TestList);