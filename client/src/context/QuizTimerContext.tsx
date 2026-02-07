import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';

// --- Types ---
interface TimerState {
    secondsRemaining: number; // For countdown
    secondsElapsed: number;   // For count-up
    isActive: boolean;
    mode: 'countdown' | 'countup';
    totalDuration: number;    // For calculating progress bars if needed later
}

type TimerAction = 
    | { type: 'START' }
    | { type: 'STOP' }
    | { type: 'TICK' }
    | { type: 'SYNC'; payload: { remaining: number; elapsed: number } }
    | { type: 'SET_TIME'; payload: { duration: number; mode: 'countdown' | 'countup' } }
    | { type: 'RESET' };

interface QuizTimerContextType {
    timerState: TimerState;
    startTimer: () => void;
    stopTimer: () => void;
    /**
     * Initialize the timer configuration.
     * @param duration Total seconds (for countdown) or 0 (for countup)
     * @param mode 'countdown' | 'countup'
     */
    initializeTimer: (duration: number, mode: 'countdown' | 'countup') => void;
    /**
     * Force sync the timer with an external source (e.g., server/localstorage restore)
     */
    syncTimer: (remaining: number, elapsed: number) => void;
    formattedTime: string;
}

// --- Reducer ---
const initialTimerState: TimerState = {
    secondsRemaining: 0,
    secondsElapsed: 0,
    isActive: false,
    mode: 'countup',
    totalDuration: 0
};

function timerReducer(state: TimerState, action: TimerAction): TimerState {
    switch (action.type) {
        case 'START':
            return { ...state, isActive: true };
        case 'STOP':
            return { ...state, isActive: false };
        case 'SET_TIME':
            return {
                ...state,
                secondsRemaining: action.payload.duration,
                secondsElapsed: 0,
                totalDuration: action.payload.duration,
                mode: action.payload.mode,
                isActive: false // Don't auto-start on init
            };
        case 'SYNC':
             return {
                ...state,
                secondsRemaining: action.payload.remaining,
                secondsElapsed: action.payload.elapsed
             };
        case 'TICK':
            if (state.mode === 'countdown') {
                const newRemaining = Math.max(0, state.secondsRemaining - 1);
                // If countdown hits zero, we might want to auto-stop or trigger an event.
                // For now, we just clamp at 0.
                return {
                    ...state,
                    secondsRemaining: newRemaining,
                    secondsElapsed: state.secondsElapsed + 1,
                    isActive: newRemaining > 0 // Auto-stop at 0?
                };
            } else {
                return {
                    ...state,
                    secondsElapsed: state.secondsElapsed + 1
                };
            }
        case 'RESET':
            return initialTimerState;
        default:
            return state;
    }
}

// --- Context ---
const QuizTimerContext = createContext<QuizTimerContextType | undefined>(undefined);

export const useQuizTimer = () => {
    const context = useContext(QuizTimerContext);
    if (!context) {
        throw new Error('useQuizTimer must be used within a QuizTimerProvider');
    }
    return context;
};

// --- Helper ---
const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// --- Provider ---
export const QuizTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(timerReducer, initialTimerState);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Persist the interval logic
    useEffect(() => {
        if (state.isActive) {
            // Clear existing to avoid double-ticks
            if (intervalRef.current) clearInterval(intervalRef.current);
            
            intervalRef.current = setInterval(() => {
                dispatch({ type: 'TICK' });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [state.isActive]);

    // Actions
    const startTimer = useCallback(() => dispatch({ type: 'START' }), []);
    const stopTimer = useCallback(() => dispatch({ type: 'STOP' }), []);
    
    const initializeTimer = useCallback((duration: number, mode: 'countdown' | 'countup') => {
        dispatch({ type: 'SET_TIME', payload: { duration, mode } });
    }, []);

    const syncTimer = useCallback((remaining: number, elapsed: number) => {
        dispatch({ type: 'SYNC', payload: { remaining, elapsed } });
    }, []);

    // Derived State for display
    // If countdown, show remaining. If countup, show elapsed.
    const displaySeconds = state.mode === 'countdown' ? state.secondsRemaining : state.secondsElapsed;
    const formattedTime = formatTime(displaySeconds);

    const value = {
        timerState: state,
        startTimer,
        stopTimer,
        initializeTimer,
        syncTimer,
        formattedTime
    };

    return (
        <QuizTimerContext.Provider value={value}>
            {children}
        </QuizTimerContext.Provider>
    );
};