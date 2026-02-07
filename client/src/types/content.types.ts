import { z } from 'zod';
import { SectionTypeSchema, QuizItemSchema } from '../schemas/quiz.schemas';

export type SectionType = z.infer<typeof SectionTypeSchema>;

/**
 * Represents a specific test or question bank within a topic.
 */
export type QuizItem = z.infer<typeof QuizItemSchema>;

/**
 * Represents the grouping of question banks (e.g., "General Chemistry").
 */
export interface QuestionBankGroup {
    category: string;
    banks: QuizItem[];
}

/**
 * The high-level structure of a Topic (returned by /api/getTopicStructure).
 */
export interface TopicStructure {
    id: string;
    name: string;
    practiceTests: QuizItem[];
    questionBanks: QuestionBankGroup[];
}

/**
 * Minimal info needed to display a topic in the sidebar.
 */
export interface TopicSummary {
    id: string;
    name: string;
}