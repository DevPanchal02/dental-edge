import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuizEngine } from '../useQuizEngine';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { Question, QuizMetadata, QuizAttempt } from '../../types/quiz.types';

// --- MOCKS ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        currentUser: { uid: 'test-uid', email: 'test@example.com' },
        userProfile: { tier: 'plus' } // Mock as paid user to bypass free-tier logic
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

// Import for Type Casting
import { getQuizData, getQuizMetadata } from '../../services/loader';
import { getInProgressAttempt, saveInProgressAttempt } from '../../services/api';

const mockGetQuizData = getQuizData as Mock;
const mockGetQuizMetadata = getQuizMetadata as Mock;
const mockGetInProgressAttempt = getInProgressAttempt as Mock;
const mockSaveInProgressAttempt = saveInProgressAttempt as Mock;

describe('useQuizEngine Integration', () => {
    
    const mockQuestions: Question[] = [
        { id: '1', question: { html_content: 'Q1' }, options: [{ label: 'A', html_content: 'A', is_correct: true }], explanation: { html_content: '' } },
        { id: '2', question: { html_content: 'Q2' }, options: [{ label: 'B', html_content: 'B', is_correct: true }], explanation: { html_content: '' } }
    ];

    const mockMetadata: QuizMetadata = {
        name: 'Practice Test 1',
        topicName: 'Biology',
        fullNameForDisplay: 'Biology Practice Test 1',
        categoryForInstructions: 'Biology'
    };

    beforeEach(() => {
        vi.resetAllMocks();
        localStorage.clear();
        mockGetQuizData.mockResolvedValue(mockQuestions);
        mockGetQuizMetadata.mockResolvedValue(mockMetadata);
        mockGetInProgressAttempt.mockResolvedValue(null);
        mockSaveInProgressAttempt.mockResolvedValue('new-attempt-id-123');
    });

    it('Practice Test Flow: Init -> Options -> Start -> Active', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        // 1. Initial Load: Should fetch data and go to OPTIONS prompt (not active yet)
        await waitFor(() => {
            expect(result.current.state.status).toBe('prompting_options');
        });

        expect(mockGetQuizData).toHaveBeenCalled();
        expect(result.current.state.quizContent.metadata).toEqual(mockMetadata);

        // 2. User Clicks "Start" in Options Modal
        await act(async () => {
            await result.current.actions.startAttemptWithOptions({ 
                prometricDelay: false, 
                additionalTime: false 
            });
        });

        // 3. Verify transition to ACTIVE
        await waitFor(() => {
            expect(result.current.state.status).toBe('active');
        });
        
        // 4. Verify Attempt Creation
        expect(mockSaveInProgressAttempt).toHaveBeenCalled();
        expect(result.current.state.attempt.id).toBe('new-attempt-id-123');
    });

    it('Correctly calculates duration based on "Additional Time" setting', async () => {
        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        await waitFor(() => expect(result.current.state.status).toBe('prompting_options'));

        // Start with 1.5x time
        await act(async () => {
            await result.current.actions.startAttemptWithOptions({ 
                prometricDelay: false, 
                additionalTime: true 
            });
        });

        // Base time is 180 mins (10800s). 1.5x should be 16200s.
        expect(result.current.state.timerSnapshot.initialDuration).toBe(16200);
        expect(result.current.state.timerSnapshot.isCountdown).toBe(true);
    });

    it('Resumes an existing attempt correctly', async () => {
        // Mock an existing attempt from DB
        const existingAttempt: Partial<QuizAttempt> = {
            id: 'resumed-id',
            currentQuestionIndex: 1, // Was on Q2
            userAnswers: { 0: 'A' },
            timer: { value: 500, isCountdown: true, initialDuration: 10800 },
            status: 'active' as const
        };
        mockGetInProgressAttempt.mockResolvedValue(existingAttempt);

        const { result } = renderHook(() => 
            useQuizEngine('biology', 'practice', 'test-1', null, false)
        );

        // Should go to RESUME prompt
        await waitFor(() => {
            expect(result.current.state.status).toBe('prompting_resume');
        });

        // User clicks Resume
        act(() => {
            result.current.actions.resumeAttempt();
        });

        expect(result.current.state.status).toBe('active');
        expect(result.current.state.attempt.currentQuestionIndex).toBe(1); // Restored index
        expect(result.current.state.attempt.userAnswers[0]).toBe('A'); // Restored answers
    });
});