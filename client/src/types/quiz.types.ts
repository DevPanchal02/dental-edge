import { z } from 'zod';
import { 
    QuestionSchema, 
    OptionSchema, 
    QuizMetadataSchema, 
    QuizAttemptSchema, 
    QuizResultSchema,
    QuestionAnalyticsSchema,
    QuestionPassageSchema
} from '../schemas/quiz.schemas';
import { SectionType } from './content.types';

// --- Inferred Types ---
export type HtmlContent = string;

export type Question = z.infer<typeof QuestionSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type QuestionAnalytics = z.infer<typeof QuestionAnalyticsSchema>;
export type QuestionPassage = z.infer<typeof QuestionPassageSchema>;
export type QuizMetadata = z.infer<typeof QuizMetadataSchema>;

// The "Serialized" attempt (DB/LocalStorage shape)
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>;

export type QuizResult = z.infer<typeof QuizResultSchema>;

// --- Runtime/Internal State Types ---

//The "Internal/Runtime" shape for the Reducer.
export interface QuizAttemptState extends Omit<QuizAttempt, 'crossedOffOptions'> {
    crossedOffOptions: Record<number, Set<string>>;
}

/**
 * Union type for the Status of the Quiz Engine
 */
export type QuizStatus = 
    | 'initializing' 
    | 'loading' 
    | 'prompting_options' 
    | 'prompting_registration' 
    | 'prompting_resume' 
    | 'active' 
    | 'reviewing_summary' 
    | 'completed' 
    | 'error' 
    | 'reviewing_attempt';

/**
 * Context Identifiers needed to load a quiz
 */
export interface QuizIdentifiers {
    topicId: string;
    sectionType: SectionType;
    quizId: string;
    reviewAttemptId?: string | null;
    isPreviewMode: boolean;
}