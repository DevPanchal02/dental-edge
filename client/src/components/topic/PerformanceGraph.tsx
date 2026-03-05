import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, CartesianGrid, ReferenceLine, Dot } from 'recharts';
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
    r?: number; 
    payload?: {
        userCorrect?: boolean;
    };
}

const PerformanceDot: React.FC<PerformanceDotProps> = (props) => {
    const { cx, cy, payload, r = 5 } = props; 
    
    if (payload?.userCorrect === undefined || cx === undefined || cy === undefined) {
        return null;
    }

    const color = payload.userCorrect ? '#10b981' : '#ef4444'; 
    const dotBorderColor = typeof document !== 'undefined' 
        ? getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() 
        : '#ffffff';

    return <Dot cx={cx} cy={cy} r={r} fill={color} stroke={dotBorderColor} strokeWidth={2} />;
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
        
        const borderColor = isCorrect ? '#10b981' : '#ef4444';
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
    topicId?: string; 
    dotRadius?: number;       
    activeDotRadius?: number; 
    correctIndices?: number[];
    incorrectIndices?: number[];
    onReviewSequence?: (indices: number[]) => void;
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ 
    questions, 
    userAttempt,
    topicId = '',
    dotRadius = 5,       
    activeDotRadius = 6,
    correctIndices,
    incorrectIndices,
    onReviewSequence
}) => {
    const { theme } = useTheme();
    const PRIMING_N = 0.5;

    // --- Data Processing ---
    const chartData = useMemo(() => {
        if (!questions || questions.length === 0) return[];
        
        let cumulativeUserCorrect = 0;
        let cumulativeAverageCorrect = 0;

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
                const userAnswer = userAttempt.userAnswers[index];
                const correctOption = q.options.find(opt => opt.is_correct);
                userCorrect = (!!userAnswer && !!correctOption && userAnswer === correctOption.label);
                
                if (userCorrect) {
                    cumulativeUserCorrect++;
                }
                userScore = (cumulativeUserCorrect + PRIMING_N) / (questionsAnswered + 2 * PRIMING_N);
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
    },[questions, userAttempt, topicId]);

    const themeColors = useMemo(() => ({
        axis: theme === 'dark' ? 'var(--text-secondary)' : '#a0a0a0',
        grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
        averageLine: theme === 'dark' ? '#666' : '#ccc',
        userLine: theme === 'dark' ? 'rgba(87, 142, 126, 0.6)' : 'rgba(87, 142, 126, 0.4)',
        deltaGreen: 'rgba(40, 167, 69, 0.15)',
        deltaRed: 'rgba(220, 53, 69, 0.15)',
        cursor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        targetLine: theme === 'dark' ? '#F5ECD5' : '#3D3D3D',
    }), [theme]);

    const renderLegendButton = (label: string, color: string, indices: number[]) => {
        const isEmpty = indices.length === 0;
        const hoverText = isEmpty 
            ? `No ${label.toLowerCase()} questions in this attempt.` 
            : `Review all ${indices.length} ${label.toLowerCase()} questions`;

        return (
            <button 
                className={`legend-item interactive-legend ${isEmpty ? 'disabled' : ''}`}
                onClick={() => !isEmpty && onReviewSequence && onReviewSequence(indices)}
                disabled={isEmpty}
                title={hoverText}
                aria-label={hoverText}
            >
                <span className="legend-box" style={{ backgroundColor: color, borderRadius: '50%' }}></span>
                {label} ({indices.length})
            </button>
        );
    };

    if (!questions || questions.length === 0) {
        return (
            <div className="performance-graph-container">
                 <div className="performance-graph-header">
                     <h3>Performance Graph</h3>
                 </div>
                 <div className="graph-loading-placeholder"><p>No data to display.</p></div>
            </div>
        );
    }

    return (
        <div className="performance-graph-container">
            {/* 
              Reusing the clean structure from PaceGraph to ensure perfect 
              alignment when placed side-by-side on the Results Page 
            */}
            <div className="performance-graph-header">
                <h3>Performance Graph</h3>
                
                <div className="performance-graph-legend">
                    {onReviewSequence && correctIndices && incorrectIndices ? (
                        <>
                            {renderLegendButton('Correct', '#10b981', correctIndices)}
                            {renderLegendButton('Incorrect', '#ef4444', incorrectIndices)}
                        </>
                    ) : (
                        <>
                            <span className="legend-item non-interactive">
                                <span className="legend-box" style={{ backgroundColor: '#10b981', borderRadius: '50%' }}></span> Correct
                            </span>
                            <span className="legend-item non-interactive">
                                <span className="legend-box" style={{ backgroundColor: '#ef4444', borderRadius: '50%' }}></span> Incorrect
                            </span>
                        </>
                    )}

                    <span className="legend-item non-interactive" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                            width: '25px', 
                            height: '2px', 
                            backgroundColor: themeColors.averageLine, 
                            display: 'inline-block' 
                        }}></span> 
                        Average
                    </span>
                </div>
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
                        <CartesianGrid stroke={themeColors.grid} strokeDasharray="3 3" vertical={false} />
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
                                    activeDot={{ r: activeDotRadius, fill: themeColors.userLine, stroke: 'none' }}
                                    dot={<PerformanceDot r={dotRadius} />}
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
        </div>
    );
};

export default React.memo(PerformanceGraph);