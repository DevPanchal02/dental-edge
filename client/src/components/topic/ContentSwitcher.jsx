// FILE: client/src/components/topic/ContentSwitcher.jsx

import React, { useState, useEffect, useRef } from 'react';
import '../../styles/TopicPage.css'; // Now uses the main TopicPage stylesheet

function ContentSwitcher({ activeTab, onTabChange }) {
    const practiceTabRef = useRef(null);
    const qbankTabRef = useRef(null);
    const [indicatorStyle, setIndicatorStyle] = useState({});

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
}

export default ContentSwitcher;