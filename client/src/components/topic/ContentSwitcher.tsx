import React, { useState, useEffect, useRef } from 'react';
import '../../styles/ContentSwitcher.css';

interface ContentSwitcherProps {
    activeTab: 'practice' | 'qbank';
    onTabChange: (tab: 'practice' | 'qbank') => void;
}

const ContentSwitcher: React.FC<ContentSwitcherProps> = ({ activeTab, onTabChange }) => {
    const practiceTabRef = useRef<HTMLButtonElement>(null);
    const qbankTabRef = useRef<HTMLButtonElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        const activeRef = activeTab === 'practice' ? practiceTabRef : qbankTabRef;
        if (activeRef.current) {
            setIndicatorStyle({
                left: activeRef.current.offsetLeft,
                width: activeRef.current.offsetWidth,
            });
        }
    }, [activeTab]);

    return (
        <div className="content-switcher">
            <button
                ref={practiceTabRef}
                className={`content-switcher-button ${activeTab === 'practice' ? 'active' : ''}`}
                onClick={() => onTabChange('practice')}
            >
                Practice Tests
            </button>
            <button
                ref={qbankTabRef}
                className={`content-switcher-button ${activeTab === 'qbank' ? 'active' : ''}`}
                onClick={() => onTabChange('qbank')}
            >
                Question Banks
            </button>
            <div className="content-switcher-indicator" style={indicatorStyle} />
        </div>
    );
};

export default React.memo(ContentSwitcher);