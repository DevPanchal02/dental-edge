// FILE: client/src/components/topic/PerformanceGraph.jsx

import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, CartesianGrid, ReferenceLine, Dot } from 'recharts';
import '../../styles/PerformanceGraph.css';
import { useTheme } from '../../context/ThemeContext';

// --- THIS IS THE FIX (Part 1): Restore the PerformanceDot component ---
const PerformanceDot = (props) => {
    const { cx, cy, payload } = props;
    
    // Only render a dot if there is a user result for this question
    if (payload.userCorrect === undefined) {
        return null;
    }

    const color = payload.userCorrect ? 'var(--text-accent)' : '#e74c3c'; // Use themed green, refined red
    const dotBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim();

    return <Dot cx={cx} cy={cy} r={5} fill={color} stroke={dotBorderColor} strokeWidth={2} />;
};


const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="graph-tooltip">
                <p className="tooltip-label">{`After Question ${label}`}</p>
                <div className="tooltip-item">
                    <span className="tooltip-color-box" style={{ backgroundColor: '#aaa' }}></span>
                    <span className="tooltip-item-name">Avg. Score:</span>
                    <span className="tooltip-item-value">{`${(data.averageScore * 100).toFixed(1)}%`}</span>
                </div>
                {data.userScore !== null && (
                     <div className="tooltip-item">
                        <span className="tooltip-color-box" style={{ backgroundColor: data.userCorrect ? 'var(--text-accent)' : '#e74c3c' }}></span>
                        <span className="tooltip-item-name">Your Score:</span>
                        <span className="tooltip-item-value">{`${(data.userScore * 100).toFixed(1)}%`}</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

function PerformanceGraph({ questions, userAttempt }) {
    const { theme } = useTheme();
    const PRIMING_N = 0.5;

    const chartData = useMemo(() => {
        if (!questions || questions.length === 0) return [];
        
        let cumulativeUserCorrect = 0;
        let cumulativeAverageCorrect = 0;

        return questions.map((q, index) => {
            const questionsAnswered = index + 1;
            
            const avgPercent = (parseFloat(q.analytics?.percent_correct) / 100) || 0.5;
            cumulativeAverageCorrect += avgPercent;

            let userScore = null;
            let userCorrect; // Keep track of correctness for the dot color

            if (userAttempt?.userAnswers) {
                const userAnswer = userAttempt.userAnswers[index];
                const correctOption = q.options.find(opt => opt.is_correct);
                
                userCorrect = (userAnswer && correctOption && userAnswer === correctOption.label);
                if (userCorrect) {
                    cumulativeUserCorrect++;
                }

                userScore = (cumulativeUserCorrect + PRIMING_N) / (questionsAnswered + 2 * PRIMING_N);
            }

            const averageScore = (cumulativeAverageCorrect + PRIMING_N) / (questionsAnswered + 2 * PRIMING_N);

            return {
                questionNumber: questionsAnswered,
                averageScore: averageScore,
                userScore: userScore,
                userCorrect: userCorrect, // Pass correctness data to the dot
            };
        });
    }, [questions, userAttempt]);

    const themeColors = useMemo(() => ({
        axis: theme === 'dark' ? 'var(--text-secondary)' : '#a0a0a0',
        grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
        averageLine: theme === 'dark' ? '#666' : '#ccc',
        // --- THIS IS THE FIX (Part 2): Use the themed accent color ---
        userLine: theme === 'dark' ? 'var(--text-accent)' : 'var(--bg-button-primary)',
        deltaGreen: 'rgba(40, 167, 69, 0.15)',
        deltaRed: 'rgba(220, 53, 69, 0.15)',
        cursor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    }), [theme]);

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
            <div className="graph-header"><h3 className="graph-title">Performance Graph</h3></div>
            <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
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
                                {/* --- THIS IS THE FIX (Part 3): Add the custom dot back to the user line --- */}
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
                                    stroke={false} 
                                    fill="url(#splitColor)"
                                    baseValue="averageScore"
                                />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </>
    );
}

export default PerformanceGraph;