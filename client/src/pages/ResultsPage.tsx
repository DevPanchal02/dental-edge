import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getQuizData, fetchTopicData, formatDisplayName } from '../services/loader';
import { getCompletedAttemptsForQuiz } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Question, QuizResult, QuizAttempt } from '../types/quiz.types'; 
import { SectionType } from '../types/content.types';
import { getErrorMessage } from '../utils/error.utils';

// Components
import ResultsGrid from '../components/ResultsGrid';
import PaceGraph from '../components/PaceGraph';
import PerformanceGraph from '../components/topic/PerformanceGraph';
import AnalyticsBreakdown from '../components/topic/AnalyticsBreakdown';
import LoadingSpinner from '../components/LoadingSpinner';

import '../styles/ResultsPage.css';

// HACK: Hardcoded time limits mirroring `useQuizLifecycle`.
const getBaseTimeLimit = (topicId: string): number => {
    const t = topicId.toLowerCase();
    if (t.includes('perceptual') || t.includes('reading')) return 60;
    if (t.includes('quantitative')) return 45;
    return 30; // Bio, Gen Chem, Orgo
};

const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
};

const ResultsPage: React.FC = () => {
    const { topicId = '', sectionType = 'practice', quizId = '' } = useParams<{ 
        topicId: string; 
        sectionType: string; 
        quizId: string; 
    }>();
    
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const targetAttemptId = (location.state as { attemptId?: string } | null)?.attemptId;

    const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
    const [topicName, setTopicName] = useState<string>('');
    const [quizName, setQuizName] = useState<string>('');
    
    const [localResult, setLocalResult] = useState<QuizResult | null>(null);
    const [fullAttempt, setFullAttempt] = useState<QuizAttempt | null>(null);
    const[attemptMeta, setAttemptMeta] = useState<{ number: number; date: string } | null>(null);
    
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadResultsData = async () => {
            setIsLoading(true);
            setError(null);

            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResultsString = localStorage.getItem(resultsKey);
            let parsedLocalResult: QuizResult | null = null;

            if (savedResultsString) {
                try {
                    parsedLocalResult = JSON.parse(savedResultsString);
                    if (isMounted) setLocalResult(parsedLocalResult);
                } catch (e) {
                    console.error("Failed to parse local results", e);
                }
            }

            try {
                const [topicData, allQuizData] = await Promise.all([
                    fetchTopicData(topicId),
                    getQuizData(topicId, sectionType, quizId)
                ]);

                if (isMounted) {
                    setTopicName(topicData.name);
                    setQuizQuestions(allQuizData ||[]);
                    const targetList = sectionType === 'practice' 
                        ? topicData.practiceTests 
                        : topicData.questionBanks.flatMap(g => g.banks);
                    const qMeta = targetList.find(q => q.id === quizId);
                    if (qMeta) setQuizName(qMeta.name);
                }

                if (currentUser) {
                    const attempts = await getCompletedAttemptsForQuiz({ topicId, sectionType, quizId });
                    
                    if (isMounted && attempts.length > 0) {
                        let selectedIndex = 0;
                        if (targetAttemptId) {
                            const foundIndex = attempts.findIndex(a => a.id === targetAttemptId);
                            if (foundIndex !== -1) selectedIndex = foundIndex;
                        }
                        
                        const selectedAttempt = attempts[selectedIndex];
                        setFullAttempt(selectedAttempt);

                        const timestamp = selectedAttempt.completedAt || selectedAttempt.createdAt || Date.now();
                        const dateStr = new Date(timestamp).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        });

                        setAttemptMeta({
                            number: attempts.length - selectedIndex,
                            date: dateStr
                        });
                    }
                } else if (!parsedLocalResult && isMounted) {
                    setError('No results found for this quiz. Please complete the quiz first.');
                }

            } catch (err: unknown) {
                if (isMounted) {
                    setError(getErrorMessage(err, "Could not load complete result analytics."));
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadResultsData();
        return () => { isMounted = false; };
    },[topicId, sectionType, quizId, currentUser, targetAttemptId]);

    const unifiedAttempt = useMemo((): QuizAttempt | null => {
        if (fullAttempt) return fullAttempt;
        if (!localResult) return null;

        return {
            id: 'local-preview',
            topicId,
            sectionType: sectionType as SectionType,
            quizId,
            userAnswers: localResult.userAnswers,
            markedQuestions: {}, 
            crossedOffOptions: {},
            userTimeSpent: {}, 
            currentQuestionIndex: 0,
            status: 'completed',
            score: localResult.score,
            timer: { value: 0, isCountdown: false, initialDuration: 0 }
        };
    },[fullAttempt, localResult, topicId, sectionType, quizId]);

    // Construct arrays of indices for targeted review sequences
    const metrics = useMemo(() => {
        if (!quizQuestions.length || !unifiedAttempt) return null;

        const totalQ = quizQuestions.length;
        const targetPaceSeconds = Math.round((getBaseTimeLimit(topicId) * 60) / totalQ);
        const timeSpentDict = unifiedAttempt.userTimeSpent || {};
        const totalTimeSeconds = Object.values(timeSpentDict).reduce((acc, curr) => acc + curr, 0);
        const avgPaceSeconds = totalTimeSeconds > 0 ? Math.round(totalTimeSeconds / totalQ) : 0;
        
        const dynamicCorrectIndices: number[] =[];
        const dynamicIncorrectIndices: number[] = [];
        const skippedIndices: number[] =[];
        const markedIndicesArray: number[] = [];
        const onPaceIndices: number[] =[];
        const overPaceIndices: number[] = [];
        const categoryIndices: Record<string, number[]> = {};

        let calculatedScore = 0;

        quizQuestions.forEach((q, index) => {
            const userAnswer = unifiedAttempt.userAnswers[index];
            const category = q.category ? q.category.trim() : 'General';
            
            // Group by Category
            if (!categoryIndices[category]) {
                categoryIndices[category] = [];
            }
            categoryIndices[category].push(index);

            // Group by Marked
            if (unifiedAttempt.markedQuestions?.[index]) {
                markedIndicesArray.push(index);
            }

            // Group by Pace
            const timeSpent = timeSpentDict[index] || 0;
            if (timeSpent > targetPaceSeconds) {
                overPaceIndices.push(index);
            } else {
                onPaceIndices.push(index);
            }
            
            // Group by Accuracy & Completion
            if (userAnswer) {
                const correctOption = q.options.find(o => o.is_correct);
                if (correctOption && userAnswer === correctOption.label) {
                    dynamicCorrectIndices.push(index);
                    calculatedScore++;
                } else {
                    dynamicIncorrectIndices.push(index);
                }
            } else {
                skippedIndices.push(index);
            }
        });

        const finalScore = calculatedScore > 0 ? calculatedScore : (unifiedAttempt.score || 0);
        
        return {
            totalQ,
            score: finalScore,
            scorePercent: ((finalScore / totalQ) * 100).toFixed(1),
            correctIndices: dynamicCorrectIndices,
            incorrectIndices: dynamicIncorrectIndices,
            skippedIndices,
            markedIndicesArray,
            onPaceIndices,
            overPaceIndices,
            categoryIndices,
            markedQuestions: unifiedAttempt.markedQuestions || {},
            timeSpentDict,
            totalTimeSeconds,
            avgPaceSeconds,
            targetPaceSeconds,
            isPaceGood: avgPaceSeconds > 0 && avgPaceSeconds <= targetPaceSeconds
        };
    },[quizQuestions, unifiedAttempt, topicId]);

    // Single Question Jump (Existing)
    const handleQuestionClick = useCallback((index: number) => {
        navigate(`/app/quiz/${topicId}/${sectionType}/${quizId}`, { 
            state: { 
                reviewAttemptId: unifiedAttempt?.id, 
                questionIndex: index 
            } 
        });
    },[navigate, topicId, sectionType, quizId, unifiedAttempt?.id]);

    // Targeted Sequence Jump (New)
    const handleTargetedReview = useCallback((indices: number[]) => {
        if (!indices || indices.length === 0) return;
        navigate(`/app/quiz/${topicId}/${sectionType}/${quizId}`, { 
            state: { 
                reviewAttemptId: unifiedAttempt?.id, 
                targetSequence: indices 
            } 
        });
    }, [navigate, topicId, sectionType, quizId, unifiedAttempt?.id]);

    if (isLoading) return <LoadingSpinner message="Analyzing Results..." />;
    
    if (error && !unifiedAttempt) return (
        <div className="page-error"> 
            {error}
            <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> 
                Back to Topic 
            </button>
        </div>
    );

    if (!metrics || !unifiedAttempt) return null;

    const displayTitle = localResult?.quizName || quizName || 'Quiz Results';

    return (
        <div className="results-page-wrapper">
            <header className="results-header-nav">
                <div className="header-left-actions">
                    <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button-results">
                         ← Back to {topicName || formatDisplayName(topicId)}
                    </button>
                </div>
                
                <div className="header-center-titles">
                    <h1 className="results-title">{displayTitle}</h1>
                    {attemptMeta && (
                        <div className="results-attempt-meta">
                            <span className="attempt-badge">Attempt #{attemptMeta.number}</span>
                            <span className="attempt-date">{attemptMeta.date}</span>
                        </div>
                    )}
                </div>

                <div className="header-right-actions"></div>
            </header>

            {/* 1. HERO METRICS */}
            <section className="results-hero-section">
                <div className="metric-card transparent-card">
                    <span className="metric-label">Final Score</span>
                    <span className="metric-value highlight-primary">
                        {metrics.score} <span className="metric-sub">/ {metrics.totalQ}</span>
                    </span>
                    <span className="metric-footer">{metrics.scorePercent}% Accuracy</span>
                </div>
                
                <div className="metric-card transparent-card">
                    <span className="metric-label">Total Time</span>
                    <span className="metric-value">
                        {metrics.totalTimeSeconds > 0 ? formatTime(metrics.totalTimeSeconds) : '--'}
                    </span>
                    <span className="metric-footer">
                        Target: {formatTime(getBaseTimeLimit(topicId) * 60)}
                    </span>
                </div>

                <div className="metric-card transparent-card">
                    <span className="metric-label">Average Pace</span>
                    <span className={`metric-value ${metrics.avgPaceSeconds > 0 ? (metrics.isPaceGood ? 'text-success' : 'text-danger') : ''}`}>
                        {metrics.avgPaceSeconds > 0 ? `${metrics.avgPaceSeconds}s` : '--'}
                    </span>
                    <span className="metric-footer">Target: {metrics.targetPaceSeconds}s / question</span>
                </div>
            </section>

            {/* 2. QUESTION GRID (Full Width) */}
            <section className="results-full-width-section">
                <div className="results-grid-wrapper transparent-card">
                    <ResultsGrid 
                        totalQuestions={metrics.totalQ}
                        correctIndices={metrics.correctIndices}
                        incorrectIndices={metrics.incorrectIndices}
                        skippedIndices={metrics.skippedIndices}
                        markedIndicesArray={metrics.markedIndicesArray}
                        markedQuestions={metrics.markedQuestions}
                        onQuestionClick={handleQuestionClick}
                        onReviewSequence={handleTargetedReview}
                    />
                </div>
            </section>

            {/* 3. GRAPHS (Side-by-Side) */}
            {metrics.totalTimeSeconds > 0 && (
                <section className="results-graphs-layout">
                    <div className="graph-panel transparent-card">
                        <PaceGraph 
                            userTimeSpent={metrics.timeSpentDict}
                            totalQuestions={metrics.totalQ}
                            targetPace={metrics.targetPaceSeconds}
                            correctIndices={metrics.correctIndices}
                            onPaceIndices={metrics.onPaceIndices}
                            overPaceIndices={metrics.overPaceIndices}
                            onReviewSequence={handleTargetedReview}
                        />
                    </div>
                    <div className="graph-panel transparent-card">
                        <PerformanceGraph 
                            questions={quizQuestions}
                            userAttempt={unifiedAttempt}
                            topicId={topicId}
                            dotRadius={3}
                            activeDotRadius={4}
                            correctIndices={metrics.correctIndices}
                            incorrectIndices={metrics.incorrectIndices}
                            onReviewSequence={handleTargetedReview}
                        />
                    </div>
                </section>
            )}

            {/* 4. CATEGORY BREAKDOWN (Bottom, Horizontal) */}
            <section className="results-full-width-section">
                <div className="results-breakdown-wrapper transparent-card">
                    <AnalyticsBreakdown 
                        userAttempt={unifiedAttempt}
                        questions={quizQuestions}
                        categoryIndices={metrics.categoryIndices}
                        onReviewSequence={handleTargetedReview}
                    />
                </div>
            </section>
        </div>
    );
};

export default ResultsPage;