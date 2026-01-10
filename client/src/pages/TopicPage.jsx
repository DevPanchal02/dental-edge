// FILE: client/src/pages/TopicPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTopicData } from '../services/loader.js';
import { getCompletedAttemptsForQuiz, getQuizAnalytics } from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';

import ContentSwitcher from '../components/topic/ContentSwitcher';
import TestList from '../components/topic/TestList';
import PerformanceGraph from '../components/topic/PerformanceGraph';
import AnalyticsBreakdown from '../components/topic/AnalyticsBreakdown';
import UpgradePromptModal from '../components/UpgradePromptModal';
import LoadingSpinner from '../components/LoadingSpinner';

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
    
    const [analyticsData, setAnalyticsData] = useState({ questions: [], attempts: [] });
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

    const topicPageDynamicStyle = useMemo(() => ({
        marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
    }), [isSidebarEffectivelyPinned]);

    useEffect(() => {
        setSelectedItemId(null);
        setSelectedItemType(null);
        setAnalyticsData({ questions: [], attempts: [] });
        setError(null);
    }, [topicId]);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (!topicId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setTopicData(null);
            
            try {
                const data = await fetchTopicData(topicId);
                if (isMounted) {
                    setTopicData(data);
                    
                    let newId = null;
                    let newType = null;

                    if (activeTab === 'qbank' && data.questionBanks?.length > 0) {
                        const firstGroup = data.questionBanks[0];
                        if (firstGroup && firstGroup.banks && firstGroup.banks.length > 0) {
                            newId = firstGroup.banks[0].id;
                            newType = 'qbank';
                        }
                    }

                    if (!newId && data.practiceTests?.length > 0) {
                        newId = data.practiceTests[0].id;
                        newType = 'practice';
                        if (activeTab === 'qbank') {
                            setActiveTab('practice');
                        }
                    }

                    if (newId) {
                        setSelectedItemId(newId);
                        setSelectedItemType(newType);
                    } else {
                        setIsLoading(false); 
                    }
                }
            } catch {
                if (isMounted) setError(`Could not load data for topic: ${topicId}.`);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadData();

        return () => { isMounted = false; };
    }, [topicId, activeTab]); 

    useEffect(() => {
        if (!selectedItemId || !selectedItemType || !topicId) {
            setAnalyticsData({ questions: [], attempts: [] });
            return;
        }

        const loadAnalytics = async () => {
            setIsAnalyticsLoading(true);
            try {
                const [questions, attempts] = await Promise.all([
                    getQuizAnalytics({ topicId, sectionType: selectedItemType, quizId: selectedItemId }),
                    getCompletedAttemptsForQuiz({ topicId, sectionType: selectedItemType, quizId: selectedItemId })
                ]);
                setAnalyticsData({ questions, attempts });
            } catch (err) {
                console.error("Error fetching analytics data:", err);
                setAnalyticsData({ questions: [], attempts: [] });
            } finally {
                setIsAnalyticsLoading(false);
            }
        };

        loadAnalytics();
    }, [selectedItemId, selectedItemType, topicId]);


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

    const handleStartQuiz = (itemId, itemType) => {
        navigate(`/app/quiz/${topicId}/${itemType}/${itemId}`);
    };

    const handleLockedItemClick = () => {
        setIsUpgradeModalOpen(true);
    };

    const itemsToShow = activeTab === 'practice' 
        ? topicData?.practiceTests?.map(item => ({ ...item, sectionType: 'practice' }))
        : topicData?.questionBanks?.flatMap(group => 
            group.banks.map(bank => ({ ...bank, sectionType: 'qbank' }))
          );
    
    const mostRecentAttempt = analyticsData.attempts?.length > 0 
        ? analyticsData.attempts.sort((a, b) => b.completedAt - a.completedAt)[0] 
        : null;

    if (isLoading) {
        return <LoadingSpinner message="Loading Topic Details..." />;
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
                            onStartQuiz={handleStartQuiz}
                            onLockedItemClick={handleLockedItemClick}
                            userProfile={userProfile}
                        />
                    </div>
                    <div className="topic-analytics-panel">
                        {isAnalyticsLoading ? (
                            <LoadingSpinner message="Loading Analytics..." />
                        ) : (
                            <>
                                <div className="analytics-component graph">
                                    <PerformanceGraph 
                                        questions={analyticsData.questions}
                                        userAttempt={mostRecentAttempt}
                                    />
                                </div>
                                <div className="analytics-component breakdown">
                                    <AnalyticsBreakdown 
                                        userAttempt={mostRecentAttempt}
                                    />
                                </div>
                            </>
                        )}
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