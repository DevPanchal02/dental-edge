import { z } from 'zod';

// --- primitive fragments ---

export const HtmlContentSchema = z.string().default('');

// --- Content: Topic & Sections ---

export const SectionTypeSchema = z.enum(['practice', 'qbank']);

export const QuizItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    sectionType: SectionTypeSchema,
    storagePath: z.string().optional(),
    _sortOrder: z.number().optional(),
    qbCategory: z.string().optional(),
});

// --- Content: Questions ---

export const OptionSchema = z.object({
    label: z.string(),
    html_content: HtmlContentSchema,
    is_correct: z.boolean(),
    percentage_selected: z.string().optional(),
});

export const QuestionAnalyticsSchema = z.object({
    percent_correct: z.string(),
    time_spent: z.string().optional(),
    category: z.string().optional(),
});

export const QuestionPassageSchema = z.object({
    html_content: HtmlContentSchema,
    id: z.string().optional(),
});

export const QuestionSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    question: z.object({
        html_content: HtmlContentSchema,
    }),
    options: z.array(OptionSchema),
    explanation: z.object({
        html_content: HtmlContentSchema,
    }),
    passage: QuestionPassageSchema.optional(),
    analytics: QuestionAnalyticsSchema.optional(),
    category: z.string().optional(),
    correct_answer_original_text: z.string().optional(),
    error: z.string().optional(),
});

export const QuizMetadataSchema = z.object({
    name: z.string(),
    topicName: z.string(),
    fullNameForDisplay: z.string(),
    categoryForInstructions: z.string(),
});

// --- User Progress: Attempts ---

// Settings specific to practice tests
export const PracticeTestSettingsSchema = z.object({
    prometricDelay: z.boolean(),
    additionalTime: z.boolean(),
});

// Timer snapshot for persistence
export const TimerSnapshotSchema = z.object({
    value: z.number(),
    isCountdown: z.boolean(),
    initialDuration: z.number(),
});

// The shape of data as it is stored in DB/LocalStorage (Serialized)
export const QuizAttemptSchema = z.object({
    id: z.string().nullable(),
    topicId: z.string(),
    sectionType: SectionTypeSchema,
    quizId: z.string(),
    
    // Maps are strictly typed
    userAnswers: z.record(z.coerce.number(), z.string()), 
    markedQuestions: z.record(z.coerce.number(), z.boolean()),
    
    // Serialized format: Arrays of strings
    crossedOffOptions: z.record(z.coerce.number(), z.array(z.string())),
    
    userTimeSpent: z.record(z.coerce.number(), z.number()),
    submittedAnswers: z.record(z.coerce.number(), z.boolean()).optional(),
    
    practiceTestSettings: PracticeTestSettingsSchema.optional(),
    
    currentQuestionIndex: z.number(),
    status: z.enum(['initializing', 'active', 'reviewing_summary', 'completed']),
    score: z.number().optional(),
    
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    completedAt: z.number().optional(),
    
    highlightedHtml: z.record(z.string(), z.string()).optional(),
    
    timer: TimerSnapshotSchema,
});

// --- Results ---

export const QuizResultSchema = z.object({
    score: z.number(),
    totalQuestions: z.number(),
    totalValidQuestions: z.number(),
    userAnswers: z.record(z.coerce.number(), z.string()),
    timestamp: z.number(),
    quizName: z.string().optional(),
    correctIndices: z.array(z.number()),
    incorrectIndices: z.array(z.number()),
});