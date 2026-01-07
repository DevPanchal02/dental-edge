// FILE: client/src/hooks/__tests__/useQuizEngine.test.jsx

import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuizEngine } from '../useQuizEngine';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- MOCK SETUP ---

const mockNavigate = vi.fn();

// Mock React Router
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

// Mock Auth Context with correct pathing
vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        currentUser: { uid: 'test-user-123', email: 'test@example.com' },
    }),
}));

// Mock Services
vi.mock('../../services/loader', () => ({
    getQuizData: vi.fn(),
    getQuizMetadata: vi.fn(),
}));

vi.mock('../../services/api', () => ({
    getInProgressAttempt: vi.fn(),
    saveInProgressAttempt: vi.fn(),
    deleteInProgressAttempt: vi.fn(),
    finalizeQuizAttempt: vi.fn(),
    getQuizAttemptById: vi.fn(),
}));

// Import mocked functions to control behavior in tests
import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt } from '../../services/api';

describe('useQuizEngine Hook', () => {
    
    // Default Mock Data
    const mockQuestions = [
        { 
            id: 1, 
            question: { html_content: '<p>Q1</p>' }, 
            options: [{ label: 'A', is_correct: true }, { label: 'B', is_correct: false }] 
        },
        { 
            id: 2, 
            question: { html_content: '<p>Q2</p>' }, 
            options: [{ label: 'A', is_correct: false }, { label: 'B', is_correct: true }] 
        }
    ];

    const mockMetadata = {
        name: 'Test Quiz',
        fullNameForDisplay: 'Test Quiz Display',
        timeLimit: 30
    };

    // Run before every individual test
    beforeEach(() => {
        // STRONG RESET: Clears history and implementation of all mocks
        vi.resetAllMocks(); 
        
        // Reset LocalStorage
        localStorage.clear();

        // Set Default Implementations (Happy Path)
        getQuizData.mockResolvedValue(mockQuestions);
        getQuizMetadata.mockResolvedValue(mockMetadata);
        getInProgressAttempt.mockResolvedValue(null); // Default: No existing attempt
        saveInProgressAttempt.mockResolvedValue('new-attempt-id-123');
    });

    it('initializes correctly and fetches quiz data', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        // We skip checking 'initializing' state because it might happen too fast.
        // Instead, we wait for the stable 'active' state.
        await waitFor(() => {
            expect(result.current.state.status).toBe('active');
        });

        // Verify data is loaded
        expect(result.current.state.quizContent.questions).toHaveLength(2);
        expect(result.current.state.quizContent.metadata.name).toBe('Test Quiz');
        
        // Verify API was called with correct args
        expect(getQuizData).toHaveBeenCalledWith('biology', 'practice', 'test-1', false);
    });

    it('handles option selection correctly', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => expect(result.current.state.status).toBe('active'));

        // Perform action
        act(() => {
            result.current.actions.selectOption(0, 'A');
        });

        // Verify state update
        expect(result.current.state.attempt.userAnswers[0]).toBe('A');
    });

    it('navigates to the next question', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => expect(result.current.state.status).toBe('active'));

        act(() => {
            result.current.actions.nextQuestion();
        });

        expect(result.current.state.attempt.currentQuestionIndex).toBe(1);
    });

    it('resumes an existing attempt if found on server', async () => {
        // OVERRIDE: Return an existing attempt ONLY for this call
        getInProgressAttempt.mockResolvedValueOnce({
            id: 'existing-id',
            currentQuestionIndex: 1,
            userAnswers: { 0: 'A' },
            timer: { value: 100, isActive: false }
        });

        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        // Expect to be prompted to resume
        await waitFor(() => {
            expect(result.current.state.status).toBe('prompting_resume');
        });

        // Verify state reflects the existing attempt
        expect(result.current.state.attempt.userAnswers[0]).toBe('A');

        // Simulate User clicking "Resume"
        act(() => {
            result.current.actions.resumeAttempt();
        });

        expect(result.current.state.status).toBe('active');
        expect(result.current.state.attempt.currentQuestionIndex).toBe(1);
    });

    it('increments timer when active', async () => {
        // Enable Fake Timers
        vi.useFakeTimers();

        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        // Manually flush the promises (getQuizData) so the hook initializes
        // We cannot use waitFor() easily with fake timers
        await act(async () => {
            // This allows the pending promises in the hook (API calls) to resolve
            // even though the timer is paused.
            await Promise.resolve(); 
        });

        const initialTime = result.current.state.timer.value;

        // Advance the fake timer by 3 seconds
        act(() => {
            vi.advanceTimersByTime(3000);
        });

        // Assert the timer has increased
        expect(result.current.state.timer.value).toBeGreaterThan(initialTime);

        // Restore Real Timers for other tests
        vi.useRealTimers();
    });
});
