// FILE: client/src/pages/TopicPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTopicData } from '../services/loader.js';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';

import ContentSwitcher from '../components/topic/ContentSwitcher';
import TestList from '../components/topic/TestList';
import PerformanceGraph from '../components/topic/PerformanceGraph';
import AnalyticsBreakdown from '../components/topic/AnalyticsBreakdown';
import UpgradePromptModal from '../components/UpgradePromptModal';

import '../styles/TopicPage.css'; 

function TopicPage() {
    const { topicId } = useParams();
    const { isSidebarEffectivelyPinned } = useLayout();
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const [topicData, setTopicData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const [activeTab, setActiveTab] = useState('practice');
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedItemType, setSelectedItemType] = useState('practice');

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (!topicId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setTopicData(null);
            
            try {
                const data = await fetchTopicData(topicId);
                if (isMounted) {
                    setTopicData(data);
                    if (data.practiceTests?.length > 0) {
                        setSelectedItemId(data.practiceTests[0].id);
                        setSelectedItemType('practice');
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError(`Could not load data for topic: ${topicId}.`);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        loadData();

        return () => { isMounted = false; };
    }, [topicId]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'practice' && topicData?.practiceTests?.length > 0) {
            setSelectedItemId(topicData.practiceTests[0].id);
            setSelectedItemType('practice');
        } else if (tab === 'qbank' && topicData?.questionBanks?.[0]?.banks.length > 0) {
            setSelectedItemId(topicData.questionBanks[0].banks[0].id);
            setSelectedItemType('qbank');
        } else {
            setSelectedItemId(null);
            setSelectedItemType(null);
        }
    };

    const handleItemSelect = (itemId, itemType) => {
        setSelectedItemId(itemId);
        setSelectedItemType(itemType);
    };

    // --- THIS IS THE FIX: New function to handle starting a quiz ---
    const handleStartQuiz = (itemId, itemType) => {
        navigate(`/app/quiz/${topicId}/${itemType}/${itemId}`);
    };

    const handleLockedItemClick = () => {
        setIsUpgradeModalOpen(true);
    };

    const topicPageDynamicStyle = {
        marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
        padding: '20px 30px'
    };
    
    // Combine and add sectionType to each item for easier handling
    const itemsToShow = activeTab === 'practice' 
        ? topicData?.practiceTests?.map(item => ({ ...item, sectionType: 'practice' }))
        : topicData?.questionBanks?.flatMap(group => 
            group.banks.map(bank => ({ ...bank, sectionType: 'qbank' }))
          );


    if (isLoading) {
        return <div className="page-loading">Loading Topic Details...</div>;
    }

    if (error) {
        return <div className="page-error">{error}</div>;
    }

    if (!topicData) {
        return <div className="page-info">Select a topic to begin.</div>;
    }

    return (
        <>
            <div className="topic-page-container" style={topicPageDynamicStyle}>
                <h1 className="topic-title">{topicData.name}</h1>
                
                <div className="topic-page-grid">
                    <div className="topic-list-panel">
                        <ContentSwitcher activeTab={activeTab} onTabChange={handleTabChange} />
                        <TestList
                            items={itemsToShow}
                            selectedItemId={selectedItemId}
                            onItemSelect={handleItemSelect}
                            onStartQuiz={handleStartQuiz} // Pass the new handler
                            onLockedItemClick={handleLockedItemClick}
                            userProfile={userProfile}
                        />
                    </div>
                    <div className="topic-analytics-panel">
                        {/* Add new class for consistent spacing */}
                        <div className="analytics-component">
                            <PerformanceGraph />
                        </div>
                        <div className="analytics-component">
                            <AnalyticsBreakdown />
                        </div>
                    </div>
                </div>
            </div>

            <UpgradePromptModal 
                isOpen={isUpgradeModalOpen} 
                onClose={() => setIsUpgradeModalOpen(false)} 
            />
        </>
    );
}

export default TopicPage;