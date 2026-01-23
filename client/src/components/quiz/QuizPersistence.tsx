import React, { useEffect, useRef } from 'react';
import { useQuiz } from '../../context/QuizContext';
import { useQuizTimer } from '../../context/QuizTimerContext';

/**
 * Headless Component: QuizPersistence
 * 
 * RESPONSIBILITY:
 * This component acts as the "Heartbeat" of the application's data layer.
 * It sits silently in the React tree and orchestrates the synchronization 
 * between the ephemeral Timer State and the persistent Database State.
 * 
 * BEHAVIOR:
 * 1. Watches the 'active' status of the quiz.
 * 2. Triggers an auto-save every 60 seconds.
 * 3. Extracts the precise time from the Timer Context and injects it into the Save Action.
 */
const QuizPersistence: React.FC = () => {
    const { state, actions } = useQuiz();
    const { timerState } = useQuizTimer();
    
    // Refs to hold mutable values without triggering re-renders of the effect
    const timerStateRef = useRef(timerState);
    const saveActionRef = useRef(actions.saveProgress);
    const statusRef = useRef(state.status);
    const isPreviewMode = state.quizIdentifiers?.isPreviewMode;

    // Keep refs synchronized with latest props/context
    useEffect(() => {
        timerStateRef.current = timerState;
        saveActionRef.current = actions.saveProgress;
        statusRef.current = state.status;
    }, [timerState, actions.saveProgress, state.status]);

    useEffect(() => {
        // Disable auto-save for Preview Mode (Guest)
        if (isPreviewMode) return;

        const AUTO_SAVE_INTERVAL_MS = 60000; // 60 Seconds

        const intervalId = setInterval(() => {
            // Only save if the quiz is actually running
            if (statusRef.current === 'active' || statusRef.current === 'reviewing_summary') {
                
                const currentTimer = timerStateRef.current;
                
                // Determine the correct value to persist based on the mode
                // Countdown: Persist seconds remaining
                // Countup: Persist seconds elapsed
                const valueToPersist = currentTimer.mode === 'countdown' 
                    ? currentTimer.secondsRemaining 
                    : currentTimer.secondsElapsed;

                // Execute the save
                if (saveActionRef.current) {
                    saveActionRef.current(valueToPersist);
                }
            }
        }, AUTO_SAVE_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [isPreviewMode]);

    return null; // Render nothing
};

export default QuizPersistence;