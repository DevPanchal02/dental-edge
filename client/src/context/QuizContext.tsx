import React, { createContext, useContext } from 'react';
import { QuizState } from '../types/quiz.reducer.types';
import { useQuizEngine } from '../hooks/useQuizEngine';

// Infer the return type of the hook so we don't have to manually type the actions interface
type QuizEngineType = ReturnType<typeof useQuizEngine>;

interface QuizContextType {
    state: QuizState;
    actions: QuizEngineType['actions'];
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const useQuiz = () => {
    const context = useContext(QuizContext);
    if (!context) {
        throw new Error('useQuiz must be used within a QuizProvider');
    }
    return context;
};

interface QuizProviderProps {
    children: React.ReactNode;
    // We inject the engine result here. 
    // This allows QuizPage to own the "logic" (router params) while Context owns the "distribution".
    value: QuizEngineType; 
}

export const QuizProvider: React.FC<QuizProviderProps> = ({ children, value }) => {
    return (
        <QuizContext.Provider value={value}>
            {children}
        </QuizContext.Provider>
    );
};