import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionCard from '../QuestionCard';

const mockQuestionData = {
    question: { html_content: '<p>What is the powerhouse of the cell?</p>' },
    options: [
        { label: 'A', html_content: 'Nucleus' },
        { label: 'B', html_content: 'Mitochondria' }
    ],
    explanation: { html_content: '<p>Mitochondria produce energy.</p>' }
};

describe('QuestionCard Component', () => {
    
    it('renders question content and options correctly', () => {
        render(
            <QuestionCard 
                questionData={mockQuestionData}
                questionIndex={0}
                selectedOption={null}
                crossedOffOptions={new Set()}
                isSubmitted={false}
                showExplanation={false}
                onOptionSelect={() => {}}
                onToggleExplanation={() => {}}
                onToggleCrossOff={() => {}}
                onToggleMark={() => {}}
            />
        );

        expect(screen.getByText('What is the powerhouse of the cell?')).toBeTruthy();
        expect(screen.getByText('Mitochondria')).toBeTruthy();
        expect(screen.getByText('Nucleus')).toBeTruthy();
    });

    it('calls onOptionSelect when an option is clicked', () => {
        const handleSelectMock = vi.fn();

        render(
            <QuestionCard 
                questionData={mockQuestionData}
                questionIndex={0}
                selectedOption={null}
                crossedOffOptions={new Set()}
                isSubmitted={false}
                onOptionSelect={handleSelectMock}
                onToggleExplanation={() => {}}
                onToggleCrossOff={() => {}}
                onToggleMark={() => {}}
            />
        );

        const optionInput = screen.getByDisplayValue('B');
        fireEvent.click(optionInput);

        expect(handleSelectMock).toHaveBeenCalledTimes(1);
        expect(handleSelectMock).toHaveBeenCalledWith(0, 'B');
    });

    it('applies selected styling to the chosen option', () => {
        // --- FIX: Removed unused 'container' destruction ---
        render(
            <QuestionCard 
                questionData={mockQuestionData}
                questionIndex={0}
                selectedOption="A"
                crossedOffOptions={new Set()}
                isSubmitted={false}
                onOptionSelect={() => {}}
                onToggleExplanation={() => {}}
                onToggleCrossOff={() => {}}
                onToggleMark={() => {}}
            />
        );

        const optionA = screen.getByText('Nucleus').closest('label');
        const optionB = screen.getByText('Mitochondria').closest('label');

        expect(optionA.className).toContain('selected');
        expect(optionB.className).not.toContain('selected');
    });

    it('shows explanation content when enabled', () => {
        render(
            <QuestionCard 
                questionData={mockQuestionData}
                questionIndex={0}
                selectedOption="A"
                crossedOffOptions={new Set()}
                isSubmitted={true} 
                isReviewMode={true}
                showExplanation={true} 
                onOptionSelect={() => {}}
                onToggleExplanation={() => {}}
                onToggleCrossOff={() => {}}
                onToggleMark={() => {}}
            />
        );

        expect(screen.getByText('Mitochondria produce energy.')).toBeTruthy();
    });
});