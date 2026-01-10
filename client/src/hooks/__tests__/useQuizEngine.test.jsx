import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuizEngine } from '../useQuizEngine';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- MOCK SETUP ---

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        currentUser: { uid: 'test-user-123', email: 'test@example.com' },
    }),
}));

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

import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt } from '../../services/api';

describe('useQuizEngine Hook', () => {
    
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

    beforeEach(() => {
        vi.resetAllMocks(); 
        localStorage.clear();

        getQuizData.mockResolvedValue(mockQuestions);
        getQuizMetadata.mockResolvedValue(mockMetadata);
        getInProgressAttempt.mockResolvedValue(null); 
        saveInProgressAttempt.mockResolvedValue('new-attempt-id-123');
    });

    it('initializes correctly and fetches quiz data', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => {
            expect(result.current.state.status).toBe('active');
        });

        expect(result.current.state.quizContent.questions).toHaveLength(2);
        expect(result.current.state.quizContent.metadata.name).toBe('Test Quiz');
        
        expect(getQuizData).toHaveBeenCalledWith('biology', 'practice', 'test-1', false);
    });

    it('handles option selection correctly', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => expect(result.current.state.status).toBe('active'));

        act(() => {
            result.current.actions.selectOption(0, 'A');
        });

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
        getInProgressAttempt.mockResolvedValueOnce({
            id: 'existing-id',
            currentQuestionIndex: 1,
            userAnswers: { 0: 'A' },
            timer: { value: 100, isActive: false }
        });

        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => {
            expect(result.current.state.status).toBe('prompting_resume');
        });

        expect(result.current.state.attempt.userAnswers[0]).toBe('A');

        act(() => {
            result.current.actions.resumeAttempt();
        });

        expect(result.current.state.status).toBe('active');
        expect(result.current.state.attempt.currentQuestionIndex).toBe(1);
    });

    it('increments timer when active', async () => {
        vi.useFakeTimers();

        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await act(async () => {
            await Promise.resolve(); 
        });

        const initialTime = result.current.state.timer.value;

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(result.current.state.timer.value).toBeGreaterThan(initialTime);

        vi.useRealTimers();
    });
});
