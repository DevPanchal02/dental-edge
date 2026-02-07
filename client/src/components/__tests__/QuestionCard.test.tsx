import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionCard from '../QuestionCard';
import { Question } from '../../types/quiz.types';

// Mock SafeHtml to simplify the DOM tree for unit testing.
vi.mock('../SafeHtml', () => ({
    default: ({ html, ...rest }: { html: string; [key: string]: any }) => (
        <div data-testid="safe-html" {...rest}>
            {html}
        </div>
    )
}));

const mockQuestion: Question = {
    id: 'q1',
    question: { html_content: 'What is the powerhouse of the cell?' },
    options: [
        { label: 'A', html_content: 'Nucleus', is_correct: false },
        { label: 'B', html_content: 'Mitochondria', is_correct: true }
    ],
    explanation: { html_content: 'Mitochondria produce energy.' },
    analytics: { percent_correct: '85', time_spent: '45s', category: 'Biology' },
    category: 'Biology',
    correct_answer_original_text: 'B'
};

describe('QuestionCard Component', () => {
    const setup = (overrides = {}) => {
        const props = {
            questionData: mockQuestion,
            questionIndex: 0,
            selectedOption: null,
            crossedOffOptions: new Set<string>(),
            isSubmitted: false,
            showExplanation: false,
            isReviewMode: false,
            isTemporarilyRevealed: false,
            isPracticeTestActive: true,
            highlightedHtml: {},
            onOptionSelect: vi.fn(),
            onToggleExplanation: vi.fn(),
            onToggleCrossOff: vi.fn(),
            onToggleMark: vi.fn(),
            ...overrides
        };

        const utils = render(<QuestionCard {...props} />);
        return { ...utils, props };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders question content and options', () => {
        setup();
        expect(screen.getByText('What is the powerhouse of the cell?')).toBeTruthy();
        expect(screen.getByText('Nucleus')).toBeTruthy();
        expect(screen.getByText('Mitochondria')).toBeTruthy();
    });

    it('handles option selection (Interactive Mode)', () => {
        const { props } = setup();

        // ARCHITECTURE NOTE: We target the radio input specifically.
        // Clicking the label in a test environment often triggers two click events 
        // (one for the label, one for the input). Clicking the input directly 
        // triggers exactly one bubbled event to our handler on the label.
        const optionBInput = screen.getByDisplayValue('B');
        fireEvent.click(optionBInput);

        expect(props.onOptionSelect).toHaveBeenCalledTimes(1);
        expect(props.onOptionSelect).toHaveBeenCalledWith(0, 'B');
    });

    it('applies "selected" class when an option is chosen', () => {
        setup({ selectedOption: 'A' });

        const optionA = screen.getByText('Nucleus').closest('label');
        const optionB = screen.getByText('Mitochondria').closest('label');

        expect(optionA?.className).toContain('selected');
        expect(optionB?.className).not.toContain('selected');
    });

    it('displays grading styles when submitted (Review Mode)', () => {
        setup({
            isSubmitted: true,
            isReviewMode: true,
            selectedOption: 'A'
        });

        const optionA = screen.getByText('Nucleus').closest('label');
        const optionB = screen.getByText('Mitochondria').closest('label');

        expect(optionA?.className).toContain('incorrect');
        expect(optionB?.className).toContain('correct');
    });

    it('shows explanation when toggle is active and in correct state', () => {
        setup({
            isSubmitted: true,
            isReviewMode: true,
            showExplanation: true 
        });

        expect(screen.getByText('Mitochondria produce energy.')).toBeTruthy();
    });

    it('prevents selection when crossed off', () => {
        const { props } = setup({
            crossedOffOptions: new Set(['B'])
        });

        const optionBInput = screen.getByDisplayValue('B');
        fireEvent.click(optionBInput);

        // Selection should be blocked by the 'crossedOffOptions.has' check in handleSelect
        expect(props.onOptionSelect).not.toHaveBeenCalled();
    });
});