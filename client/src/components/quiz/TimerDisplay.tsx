import React from 'react';
import { useQuizTimer } from '../../context/QuizTimerContext';
import '../../styles/QuizPage.css';

interface TimerDisplayProps {
    className?: string;
    showTotal?: boolean;
    label?: string; // Optional override for "Time Left" / "Time Elapsed"
}

/**
 * Component that subscribes to the High-Frequency Timer Context.
 * Isolates re-renders to this component only.
 */
const TimerDisplay: React.FC<TimerDisplayProps> = ({ className, showTotal = true, label }) => {
    const { timerState, formattedTime } = useQuizTimer();
    
    // Determine default label based on mode if not provided
    const displayLabel = label || (timerState.mode === 'countdown' ? 'Time Left: ' : 'Time Elapsed: ');
    
    // Calculate CSS classes
    const isLowTime = timerState.mode === 'countdown' && timerState.secondsRemaining < 60 && timerState.secondsRemaining > 0;
    const containerClass = className || "timer-display";
    const timeClass = isLowTime ? "timer-low" : "";

    const formatTotal = (total: number) => {
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className={containerClass}>
            {displayLabel}
            <span className={timeClass}>
                {formattedTime}
            </span>
            {showTotal && timerState.mode === 'countdown' && timerState.totalDuration > 0 && (
                <span className="timer-total"> / {formatTotal(timerState.totalDuration)}</span>
            )}
        </div>
    );
};

export default React.memo(TimerDisplay);