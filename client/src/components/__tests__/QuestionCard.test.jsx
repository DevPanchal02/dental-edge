// FILE: client/src/components/__tests__/QuestionCard.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionCard from '../QuestionCard';

// Mock data representing a standard multiple-choice question
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

        // Verify the main question text is present
        expect(screen.getByText('What is the powerhouse of the cell?')).toBeTruthy();
        
        // Verify both options are rendered
        expect(screen.getByText('Mitochondria')).toBeTruthy();
        expect(screen.getByText('Nucleus')).toBeTruthy();
    });

    it('calls onOptionSelect when an option is clicked', () => {
        // Create a spy function to track calls
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

        // Target the specific input element by its value ('B')
        // This ensures we don't accidentally trigger label-click bubbling issues in JSDOM
        const optionInput = screen.getByDisplayValue('B');
        
        fireEvent.click(optionInput);

        // Assert the mock was called exactly once with the correct arguments
        expect(handleSelectMock).toHaveBeenCalledTimes(1);
        expect(handleSelectMock).toHaveBeenCalledWith(0, 'B');
    });

    it('applies selected styling to the chosen option', () => {
        // Render with Option A selected
        const { container } = render(
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

        // Find the label wrapping the "Nucleus" text
        const optionA = screen.getByText('Nucleus').closest('label');
        // Find the label wrapping the "Mitochondria" text
        const optionB = screen.getByText('Mitochondria').closest('label');

        // Check for the existence of the CSS class
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
                isSubmitted={true} // Must be submitted/reviewed to show explanations
                isReviewMode={true}
                showExplanation={true} // The prop driving this test
                onOptionSelect={() => {}}
                onToggleExplanation={() => {}}
                onToggleCrossOff={() => {}}
                onToggleMark={() => {}}
            />
        );

        // Verify explanation text appears
        expect(screen.getByText('Mitochondria produce energy.')).toBeTruthy();
    });
});
