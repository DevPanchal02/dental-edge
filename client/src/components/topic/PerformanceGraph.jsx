// FILE: client/src/components/topic/PerformanceGraph.jsx

import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Dot } from 'recharts';
import '../../styles/PerformanceGraph.css';
import { useTheme } from '../../context/ThemeContext';

// Custom Dot component for the chart
const PerformanceDot = ({ cx, cy, payload }) => {
    if (payload.userCorrect === undefined) {
        return null;
    }
    const color = payload.userCorrect ? '#28a745' : '#dc3545';
    return <Dot cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />;
};

// Custom Tooltip for more detailed info on hover
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const userCorrect = data.userCorrect;
        
        return (
            <div className="graph-tooltip">
                <p className="tooltip-label">{`Question ${label}`}</p>
                <div className="tooltip-item">
                    <span className="tooltip-item-name">Difficulty:</span>
                    <span className="tooltip-item-value">{`${data.difficulty.toFixed(1)}%`}</span>
                </div>
                {userCorrect !== undefined && (
                     <div className="tooltip-item">
                        <span className="tooltip-color-box" style={{ backgroundColor: userCorrect ? '#28a745' : '#dc3545' }}></span>
                        <span className="tooltip-item-name">Your Answer:</span>
                        <span className="tooltip-item-value">{userCorrect ? 'Correct' : 'Incorrect'}</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
};


function PerformanceGraph({ questions, userAttempt }) {
    const { theme } = useTheme();

    const chartData = useMemo(() => {
        if (!questions || questions.length === 0) {
            return [];
        }

        return questions.map((q, index) => {
            const percentCorrect = parseFloat(q.analytics?.percent_correct) || 0;
            const difficulty = 100 - percentCorrect;

            let userCorrect;
            if (userAttempt?.userAnswers) {
                const userAnswer = userAttempt.userAnswers[index];
                const correctOption = q.options.find(opt => opt.is_correct);
                if (userAnswer && correctOption) {
                    userCorrect = userAnswer === correctOption.label;
                } else {
                    userCorrect = false;
                }
            }

            return {
                questionNumber: index + 1,
                difficulty: difficulty,
                userCorrect: userCorrect,
            };
        });
    }, [questions, userAttempt]);

    const gridColor = theme === 'dark' ? '#333333' : '#E0D8C5';
    const axisColor = theme === 'dark' ? '#BEB3A2' : '#5E5E5E';
    const lineColor = theme === 'dark' ? '#578E7E' : '#A7B0B9';

    if (!questions || questions.length === 0) {
        return (
            <div className="graph-container">
                 <div className="graph-header"><h3 className="graph-title">Performance Graph</h3></div>
                 <div className="graph-loading-placeholder">
                    <p>No question data available to display graph.</p>
                 </div>
            </div>
        );
    }

    return (
        <div className="graph-container">
            <div className="graph-header">
                <h3 className="graph-title">Performance Graph</h3>
            </div>
            {/* --- THIS IS THE DEFINITIVE FIX --- */}
            {/* 1. The parent div MUST have position: relative and an explicit height */}
            <div style={{ position: 'relative', width: '100%', height: '250px' }}>
                {/* 2. ResponsiveContainer now has absolute positioning to fill the parent */}
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 20 }} // Increased bottom margin for label
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis 
                            dataKey="questionNumber" 
                            stroke={axisColor}
                            tick={{ fontSize: 12 }}
                            label={{ value: 'Question Number', position: 'insideBottom', offset: -10, fill: axisColor, fontSize: 12 }}
                        />
                        <YAxis 
                            stroke={axisColor} 
                            tick={{ fontSize: 12 }}
                            label={{ value: 'Difficulty', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12, dx: -5 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line 
                            type="monotone" 
                            dataKey="difficulty" 
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                        />
                        {userAttempt && (
                            <Line 
                                dataKey="difficulty" 
                                stroke="transparent" 
                                activeDot={false}
                                dot={<PerformanceDot />}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default PerformanceGraph;