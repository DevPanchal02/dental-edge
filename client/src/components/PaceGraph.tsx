import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import '../styles/ResultsPage.css';

interface PaceGraphProps {
    userTimeSpent: Record<number, number>;
    totalQuestions: number;
    targetPace: number; // in seconds
    correctIndices: number[];
}

interface ChartDataPoint {
    questionNumber: number;
    time: number;
    target: number;
    isCorrect: boolean;
    isOverPace: boolean;
}

/**
 * Custom dot renderer to maintain the "heat map" effect on a line chart.
 * Highlights individual questions that acted as time-sinks.
 */
const PaceDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    if (cx == null || cy == null || !payload) return null;

    const isOverPace = payload.time > payload.target;
    const fill = isOverPace ? '#ef4444' : '#10b981'; // Red if over pace, Green if under/on pace
    
    // Grab the CSS variable for the background to make the dot "pop" with a border
    const strokeColor = typeof document !== 'undefined' 
        ? getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() 
        : '#ffffff';

    return (
        <circle 
            cx={cx} 
            cy={cy} 
            r={5} 
            fill={fill} 
            stroke={strokeColor} 
            strokeWidth={2} 
        />
    );
};

/**
 * Custom tooltip to display pacing context and accuracy without cluttering the UI.
 * NOTE: Typed as 'any' to prevent Recharts version conflicts, but cast internally for safety.
 */
const CustomPaceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Safe cast: We know our data structure matches ChartDataPoint
        const data = payload[0].payload as ChartDataPoint;
        if (!data) return null;

        const isOverPace = data.isOverPace;
        
        return (
            <div className="compact-tooltip" style={{ borderLeftColor: isOverPace ? '#ef4444' : '#10b981' }}>
                <div className="compact-tooltip-header">
                    <span className="compact-tooltip-title">Question {label}</span>
                    <span className={`compact-badge ${data.isCorrect ? 'correct' : 'incorrect'}`}>
                        {data.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                </div>
                <div className="compact-tooltip-body">
                    <div className="compact-row">
                        <span className="compact-label">Time Spent:</span>
                        <span className={`compact-value ${isOverPace ? 'text-danger' : 'text-success'}`}>
                            {data.time}s
                        </span>
                    </div>
                    <div className="compact-row">
                        <span className="compact-label">Target Pace:</span>
                        <span className="compact-value">{data.target}s</span>
                    </div>
                    <div className="compact-row">
                        <span className="compact-label">Delta:</span>
                        <span className="compact-value">
                            {isOverPace ? '+' : ''}{data.time - data.target}s
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

/**
 * Visualizes time spent per question against the required exam pace using a smooth curve.
 */
const PaceGraph: React.FC<PaceGraphProps> = ({
    userTimeSpent,
    totalQuestions,
    targetPace,
    correctIndices
}) => {
    const { theme } = useTheme();

    const correctSet = useMemo(() => new Set(correctIndices), [correctIndices]);

    // Flatten dictionary into Recharts-compatible array.
    const chartData: ChartDataPoint[] = useMemo(() => {
        return Array.from({ length: totalQuestions }, (_, i) => {
            const time = userTimeSpent[i] || 0;
            return {
                questionNumber: i + 1,
                time: time,
                target: targetPace,
                isCorrect: correctSet.has(i),
                isOverPace: time > targetPace
            };
        });
    }, [userTimeSpent, totalQuestions, targetPace, correctSet]);

    // Theme-aware colors to ensure high contrast in both light and dark modes
    const themeColors = useMemo(() => ({
        axis: theme === 'dark' ? 'var(--text-secondary)' : '#a0a0a0',
        grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        line: theme === 'dark' ? 'rgba(87, 142, 126, 0.5)' : 'rgba(87, 142, 126, 0.3)',
        targetLine: theme === 'dark' ? '#F5ECD5' : '#3D3D3D',
        cursor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        goodPace: '#10b981', 
        badPace: '#ef4444'   
    }), [theme]);

    if (!totalQuestions) return null;

    return (
        <div className="pace-graph-container">
            <div className="pace-graph-header">
                <h3>Pacing Analysis</h3>
                <div className="pace-graph-legend">
                    <span className="legend-item">
                        <span className="legend-box" style={{ backgroundColor: themeColors.goodPace, borderRadius: '50%' }}></span> On Pace
                    </span>
                    <span className="legend-item">
                        <span className="legend-box" style={{ backgroundColor: themeColors.badPace, borderRadius: '50%' }}></span> Over Time
                    </span>
                    <span className="legend-item">
                        <span className="legend-line" style={{ borderBottom: `2px dashed ${themeColors.targetLine}` }}></span> Target Pace ({targetPace}s)
                    </span>
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid stroke={themeColors.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                            dataKey="questionNumber" 
                            stroke={themeColors.axis}
                            tick={{ fontSize: 12, fill: themeColors.axis }}
                            tickLine={false} 
                            axisLine={false}
                            label={{ value: 'Question Number', position: 'insideBottom', offset: -10, fill: themeColors.axis, fontSize: 12 }}
                        />
                        <YAxis 
                            stroke={themeColors.axis} 
                            tick={{ fontSize: 12, fill: themeColors.axis }}
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => `${value}s`}
                            domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, targetPace * 1.1)]} 
                        />
                        <Tooltip 
                            content={<CustomPaceTooltip />} 
                            cursor={{ stroke: themeColors.cursor, strokeWidth: 2 }} 
                        />
                        
                        <ReferenceLine 
                            y={targetPace} 
                            stroke={themeColors.targetLine} 
                            strokeDasharray="5 5" 
                            strokeWidth={2}
                            label={{ 
                                position: 'insideTopLeft', 
                                value: ' Target Pace', 
                                fill: themeColors.targetLine, 
                                fontSize: 12,
                                fontWeight: 600
                            }}
                        />
                        
                        <Line 
                            type="monotone" 
                            dataKey="time" 
                            stroke={themeColors.line} 
                            strokeWidth={3} 
                            activeDot={{ r: 7, fill: themeColors.targetLine, stroke: 'none' }}
                            dot={<PaceDot />}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default React.memo(PaceGraph);