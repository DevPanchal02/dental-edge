import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, CartesianGrid, ReferenceLine, Dot } from 'recharts';
import { FaChevronLeft, FaChevronRight, FaEye } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import '../../styles/PerformanceGraph.css';
import { useTheme } from '../../context/ThemeContext';
import { Question, QuizAttempt } from '../../types/quiz.types';

// --- Helper: Time Limit Logic ---
const getBaseTimeLimitMinutes = (topicId: string = ''): number => {
    const t = topicId.toLowerCase();
    if (t.includes('perceptual') || t.includes('reading')) return 60;
    if (t.includes('quantitative')) return 45;
    return 30; // Bio, Gen Chem, Orgo
};

// --- Helper Components ---

interface PerformanceDotProps {
    cx?: number;
    cy?: number;
    payload?: {
        userCorrect?: boolean;
    };
}

// Hardcode bright hexes so points pop against both light/dark backgrounds.
const PerformanceDot: React.FC<PerformanceDotProps> = (props) => {
    const { cx, cy, payload } = props;
    
    if (payload?.userCorrect === undefined || cx === undefined || cy === undefined) {
        return null;
    }

    const color = payload.userCorrect ? '#10b981' : '#ef4444'; // Bright Emerald / Bright Red
    const dotBorderColor = typeof document !== 'undefined' 
        ? getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() 
        : '#ffffff';

    return <Dot cx={cx} cy={cy} r={5} fill={color} stroke={dotBorderColor} strokeWidth={2} />;
};

interface TooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
}

const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isCorrect = data.userCorrect;
        
        // Explicitly color the left border based on correctness
        const borderColor = isCorrect ? '#10b981' : '#ef4444';
        
        // Evaluate if user met the target time
        const isGoodTime = data.timeSpent <= data.maintenancePace;

        return (
            <div className="compact-tooltip" style={{ borderLeftColor: borderColor }}>
                <div className="compact-tooltip-header">
                    <span className="compact-tooltip-title">Question {label}</span>
                    <span className={`compact-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                </div>
                
                <div className="compact-tooltip-body">
                    <div className="compact-row">
                        <span className="compact-label">Category:</span>
                        <span className="compact-value">{data.category || 'General'}</span>
                    </div>

                    <div className="compact-row">
                        <span className="compact-label">Time:</span>
                        {/* Flex container to separate user time badge and target text */}
                        <span className="compact-value time-group">
                            <span className={`time-badge ${isGoodTime ? 'good' : 'bad'}`}>
                                {data.timeSpent}s
                            </span>
                            <span className="compact-subtext">Target Pace: {data.maintenancePace}s</span>
                        </span>
                    </div>

                    <div className="compact-row">
                        <span className="compact-label">% Answered Correctly:</span>
                        <span className="compact-value">{data.percentCorrect}%</span>
                    </div>
                </div>

                <div className="compact-tooltip-footer">
                    <span>Cumulative Score:</span>
                    <strong>{(data.userScore * 100).toFixed(1)}%</strong>
                </div>
            </div>
        );
    }
    return null;
};

// --- Main Component ---

interface PerformanceGraphProps {
    questions: Question[];
    userAttempt: QuizAttempt | null | undefined;
    attemptIndex?: number;
    totalAttempts?: number;
    topicId?: string; 
    onPrev?: () => void;
    onNext?: () => void;
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ 
    questions, 
    userAttempt,
    attemptIndex = 0,
    totalAttempts = 0,
    topicId = '',
    onPrev,
    onNext
}) => {
    const { theme } = useTheme();
    const PRIMING_N = 0.5;

    // --- Data Processing ---
    const chartData = useMemo(() => {
        if (!questions || questions.length === 0) return[];
        
        let cumulativeUserCorrect = 0;
        let cumulativeAverageCorrect = 0;

        // Calculate Target Pace
        const timeLimitMinutes = getBaseTimeLimitMinutes(topicId);
        const totalSeconds = timeLimitMinutes * 60;
        const maintenancePace = questions.length > 0 
            ? Math.round(totalSeconds / questions.length) 
            : 0;

        return questions.map((q, index) => {
            const questionsAnswered = index + 1;
            
            const analyticsPercent = q.analytics?.percent_correct 
                ? parseFloat(q.analytics.percent_correct) 
                : 50; 
            
            const avgPercent = (analyticsPercent / 100) || 0.5;
            cumulativeAverageCorrect += avgPercent;

            let userScore = null;
            let userCorrect: boolean | undefined;
            let timeSpent = 0;

            if (userAttempt) {
                // Correctness
                const userAnswer = userAttempt.userAnswers[index];
                const correctOption = q.options.find(opt => opt.is_correct);
                userCorrect = (!!userAnswer && !!correctOption && userAnswer === correctOption.label);
                
                if (userCorrect) {
                    cumulativeUserCorrect++;
                }
                userScore = (cumulativeUserCorrect + PRIMING_N) / (questionsAnswered + 2 * PRIMING_N);

                // Time Spent
                timeSpent = userAttempt.userTimeSpent?.[index] || 0;
            }

            const averageScore = (cumulativeAverageCorrect + PRIMING_N) / (questionsAnswered + 2 * PRIMING_N);

            return {
                questionNumber: questionsAnswered,
                averageScore: averageScore,
                userScore: userScore,
                userCorrect: userCorrect,
                
                category: q.category || 'General',
                percentCorrect: analyticsPercent, 
                timeSpent: timeSpent,
                maintenancePace: maintenancePace
            };
        });
    }, [questions, userAttempt, topicId]);

    const themeColors = useMemo(() => ({
        axis: theme === 'dark' ? 'var(--text-secondary)' : '#a0a0a0',
        grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
        averageLine: theme === 'dark' ? '#666' : '#ccc',
        // Use a subtle, semi-transparent teal so the bright red/green dots stand out
        userLine: theme === 'dark' ? 'rgba(87, 142, 126, 0.6)' : 'rgba(87, 142, 126, 0.4)',
        deltaGreen: 'rgba(40, 167, 69, 0.15)',
        deltaRed: 'rgba(220, 53, 69, 0.15)',
        cursor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    }), [theme]);

    const dateString = useMemo(() => {
        if (!userAttempt) return '';
        const timestamp = userAttempt.completedAt || userAttempt.createdAt || Date.now();
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }, [userAttempt]);

    const attemptNumber = totalAttempts - attemptIndex;

    if (!questions || questions.length === 0) {
        return (
            <div>
                 <div className="graph-header"><h3 className="graph-title">Performance Graph</h3></div>
                 <div className="graph-loading-placeholder"><p>No data to display.</p></div>
            </div>
        );
    }

    return (
        <>
            <div className="graph-header-container">
                <h3 className="graph-title">Performance Graph</h3>
                
                {userAttempt && totalAttempts > 0 && (
                    <div className="graph-navigation-controls">
                        <button 
                            className="graph-nav-button" 
                            onClick={onPrev}
                            disabled={attemptIndex >= totalAttempts - 1}
                            title="Older Attempt"
                        >
                            <FaChevronLeft />
                        </button>
                        
                        <div className="graph-attempt-info">
                            <span className="attempt-label">Attempt #{attemptNumber}</span>
                            <span className="attempt-date">{dateString}</span>
                        </div>

                        {/* FIX: Link to ResultsPage, not QuizPage */}
                        <Link 
                            to={`/app/results/${userAttempt.topicId}/${userAttempt.sectionType}/${userAttempt.quizId}`}
                            state={{ attemptId: userAttempt.id }}
                            className="graph-view-button"
                            title="View Results"
                        >
                            <FaEye />
                        </Link>

                        <button 
                            className="graph-nav-button" 
                            onClick={onNext}
                            disabled={attemptIndex <= 0}
                            title="Newer Attempt"
                        >
                            <FaChevronRight />
                        </button>
                    </div>
                )}
            </div>

            <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%" debounce={300}>
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <defs>
                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="50%" stopColor={themeColors.deltaGreen} stopOpacity={1} />
                                <stop offset="50%" stopColor={themeColors.deltaRed} stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke={themeColors.grid} strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="questionNumber" 
                            stroke={themeColors.axis}
                            tick={{ fontSize: 12, fill: themeColors.axis }}
                            tickLine={false} axisLine={false}
                            label={{ value: 'Question Number', position: 'insideBottom', offset: -10, fill: themeColors.axis, fontSize: 12 }}
                        />
                        <YAxis 
                            stroke={themeColors.axis} 
                            tick={{ fontSize: 12, fill: themeColors.axis }}
                            tickLine={false} axisLine={false}
                            domain={[0, 1]}
                            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: themeColors.cursor, strokeWidth: 2 }} />
                        
                        <Line type="monotone" dataKey="averageScore" stroke={themeColors.averageLine} strokeWidth={2} dot={false} activeDot={false} />
                        
                        {userAttempt && (
                            <>
                                <ReferenceLine y={0.5} stroke={themeColors.grid} strokeDasharray="3 3" />
                                <Line 
                                    type="monotone" 
                                    dataKey="userScore" 
                                    stroke={themeColors.userLine} 
                                    strokeWidth={2} 
                                    activeDot={{ r: 6, fill: themeColors.userLine, stroke: 'none' }}
                                    dot={<PerformanceDot />}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="userScore" 
                                    stroke="none"
                                    fill="url(#splitColor)"
                                    baseValue={"averageScore" as any}
                                />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </>
    );
};

export default React.memo(PerformanceGraph);