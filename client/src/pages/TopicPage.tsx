import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTopicData } from '../services/loader';
import { getCompletedAttemptsForQuiz, getQuizAnalytics } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';

import ContentSwitcher from '../components/topic/ContentSwitcher';
import TestList from '../components/topic/TestList';
import PerformanceGraph from '../components/topic/PerformanceGraph';
import AnalyticsBreakdown from '../components/topic/AnalyticsBreakdown';
import UpgradePromptModal from '../components/UpgradePromptModal';
import LoadingSpinner from '../components/LoadingSpinner';

import '../styles/TopicPage.css'; 
import { TopicStructure, SectionType } from '../types/content.types';
import { Question, QuizAttempt } from '../types/quiz.types';

interface AnalyticsState {
    questions: Question[];
    attempts: QuizAttempt[];
}

function TopicPage() {
    const { topicId } = useParams<{ topicId: string }>();
    const { isSidebarEffectivelyPinned } = useLayout();
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const [topicData, setTopicData] = useState<TopicStructure | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

    const [activeTab, setActiveTab] = useState<'practice' | 'qbank'>('practice');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedItemType, setSelectedItemType] = useState<SectionType | null>('practice');
    
    const [analyticsData, setAnalyticsData] = useState<AnalyticsState>({ questions: [], attempts: [] });
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(false);

    // This style object is stable unless pinning changes
    const topicPageDynamicStyle = useMemo(() => ({
        marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
        width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
    }), [isSidebarEffectivelyPinned]);

    // Reset selection on topic change
    useEffect(() => {
        setSelectedItemId(null);
        setSelectedItemType(null);
        setAnalyticsData({ questions: [], attempts: [] });
        setError(null);
    }, [topicId]);

    // Load Topic Data
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
                    
                    let newId: string | null = null;
                    let newType: SectionType | null = null;

                    // Logic to auto-select the first item if nothing is selected
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

    // Load Analytics
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


    // Handlers wrapped in useCallback to prevent child re-renders
    const handleTabChange = useCallback((tab: 'practice' | 'qbank') => {
        setActiveTab(tab);
        // We need topicData to set the default item, but topicData is in state.
        // We can't easily avoid the dependency on topicData, but since topicData is stable after load, it's fine.
        setTopicData(currentTopicData => {
            if (!currentTopicData) return null;
            
            let newId = null;
            let newType: SectionType | null = null;

            if (tab === 'practice' && currentTopicData.practiceTests?.length > 0) {
                newId = currentTopicData.practiceTests[0].id;
                newType = 'practice';
            } else if (tab === 'qbank' && currentTopicData.questionBanks?.[0]?.banks.length > 0) {
                newId = currentTopicData.questionBanks[0].banks[0].id;
                newType = 'qbank';
            }

            if (newId && newType) {
                setSelectedItemId(newId);
                setSelectedItemType(newType);
            } else {
                setSelectedItemId(null);
                setSelectedItemType(null);
            }
            return currentTopicData;
        });
    }, []);

    const handleItemSelect = useCallback((itemId: string, itemType: SectionType) => {
        setSelectedItemId(itemId);
        setSelectedItemType(itemType);
    }, []);

    const handleStartQuiz = useCallback((itemId: string, itemType: SectionType) => {
        // We need topicId from closure, which is fine as it's a route param
        if (topicId) {
            navigate(`/app/quiz/${topicId}/${itemType}/${itemId}`);
        }
    }, [topicId, navigate]);

    const handleLockedItemClick = useCallback(() => {
        setIsUpgradeModalOpen(true);
    }, []);

    // Memoize the items list to prevent TestList from re-rendering unnecessarily
    const itemsToShow = useMemo(() => {
        return activeTab === 'practice' 
            ? topicData?.practiceTests?.map(item => ({ ...item, sectionType: 'practice' as SectionType }))
            : topicData?.questionBanks?.flatMap(group => 
                group.banks.map(bank => ({ ...bank, sectionType: 'qbank' as SectionType }))
              );
    }, [activeTab, topicData]);
    
    const mostRecentAttempt = useMemo(() => {
        return analyticsData.attempts?.length > 0 
            ? [...analyticsData.attempts].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0] 
            : null;
    }, [analyticsData.attempts]);

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