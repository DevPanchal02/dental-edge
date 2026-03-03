import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTopicData } from '../services/loader';
import { getCompletedAttemptsForQuiz, getQuizAnalytics } from '../services/api';
import { useAuth } from '../context/AuthContext';

import ContentSwitcher from '../components/topic/ContentSwitcher';
import TestList from '../components/topic/TestList';
import PerformanceGraph from '../components/topic/PerformanceGraph';
import AnalyticsBreakdown from '../components/topic/AnalyticsBreakdown';
import UpgradePromptModal from '../components/UpgradePromptModal';
import LoadingSpinner from '../components/LoadingSpinner';

import '../styles/TopicPage.css'; 
import { TopicStructure, SectionType } from '../types/content.types';
import { Question, QuizAttempt } from '../types/quiz.types';
import { getErrorMessage } from '../utils/error.utils';

interface AnalyticsState {
    questions: Question[];
    attempts: QuizAttempt[];
}

function TopicPage() {
    const { topicId } = useParams<{ topicId: string }>();
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const [topicData, setTopicData] = useState<TopicStructure | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

    const [activeTab, setActiveTab] = useState<'practice' | 'qbank'>('practice');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedItemType, setSelectedItemType] = useState<SectionType | null>('practice');
    
    // Analytics Data State
    const [analyticsData, setAnalyticsData] = useState<AnalyticsState>({ questions: [], attempts: [] });
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(false);

    // Attempt Navigation State
    const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(0);

    // Reset selection on topic change
    useEffect(() => {
        setSelectedItemId(null);
        setSelectedItemType(null);
        setAnalyticsData({ questions: [], attempts:[] });
        setSelectedAttemptIndex(0);
        setError(null);
    }, [topicId]);

    // Reset attempt index when selecting a new quiz item
    useEffect(() => {
        setSelectedAttemptIndex(0);
    },[selectedItemId, selectedItemType]);

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

                    // Auto-select logic
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
            } catch (err: unknown) {
                if (isMounted) {
                    const msg = getErrorMessage(err, `Could not load data for topic: ${topicId}.`);
                    setError(msg);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadData();

        return () => { isMounted = false; };
    },[topicId, activeTab]); 

    // Load Analytics
    useEffect(() => {
        if (!selectedItemId || !selectedItemType || !topicId) {
            setAnalyticsData({ questions: [], attempts:[] });
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
            } catch (err: unknown) {
                const msg = getErrorMessage(err, "Failed to load performance analytics.");
                console.error("Analytics Load Error:", msg);
                setAnalyticsData({ questions: [], attempts:[] });
            } finally {
                setIsAnalyticsLoading(false);
            }
        };

        loadAnalytics();
    }, [selectedItemId, selectedItemType, topicId]);

    // Handlers
    const handleTabChange = useCallback((tab: 'practice' | 'qbank') => {
        setActiveTab(tab);
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
    },[]);

    const handleItemSelect = useCallback((itemId: string, itemType: SectionType) => {
        setSelectedItemId(itemId);
        setSelectedItemType(itemType);
    },[]);

    const handleStartQuiz = useCallback((itemId: string, itemType: SectionType) => {
        if (topicId) {
            navigate(`/app/quiz/${topicId}/${itemType}/${itemId}`);
        }
    }, [topicId, navigate]);

    const handleLockedItemClick = useCallback(() => {
        setIsUpgradeModalOpen(true);
    },[]);

    const itemsToShow = useMemo(() => {
        return activeTab === 'practice' 
            ? topicData?.practiceTests?.map(item => ({ ...item, sectionType: 'practice' as SectionType }))
            : topicData?.questionBanks?.flatMap(group => 
                group.banks.map(bank => ({ ...bank, sectionType: 'qbank' as SectionType }))
              );
    }, [activeTab, topicData]);
    
    // --- Attempt Logic ---
    // Sort attempts by date descending (Newest first)
    const sortedAttempts = useMemo(() => {
        return analyticsData.attempts?.length > 0 
            ?[...analyticsData.attempts].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)) 
            : [];
    }, [analyticsData.attempts]);

    const currentAttempt = sortedAttempts[selectedAttemptIndex] || null;

    const handlePrevAttempt = useCallback(() => {
        if (selectedAttemptIndex < sortedAttempts.length - 1) {
            setSelectedAttemptIndex(prev => prev + 1);
        }
    }, [selectedAttemptIndex, sortedAttempts.length]);

    const handleNextAttempt = useCallback(() => {
        if (selectedAttemptIndex > 0) {
            setSelectedAttemptIndex(prev => prev - 1);
        }
    }, [selectedAttemptIndex]);

    if (isLoading) {
        return <LoadingSpinner message="Loading Topic Details..." />;
    }

    if (error) {
        return <div className="page-error">{error}</div>;
    }

    if (!topicData) {
        return <div className="page-info">Select a topic to begin.</div>;
    }

    // Strip out the inline style parameter. The parent `<main>` container in Layout.tsx controls the layout.
    return (
        <>
            <div className="topic-page-container">
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
                                        userAttempt={currentAttempt}
                                        attemptIndex={selectedAttemptIndex}
                                        totalAttempts={sortedAttempts.length}
                                        topicId={topicId} 
                                        onPrev={handlePrevAttempt}
                                        onNext={handleNextAttempt}
                                    />
                                </div>
                                <div className="analytics-component breakdown">
                                    <AnalyticsBreakdown 
                                        userAttempt={currentAttempt}
                                        questions={analyticsData.questions}
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