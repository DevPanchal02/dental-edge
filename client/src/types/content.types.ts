export type SectionType = 'practice' | 'qbank';

/**
 * Represents a specific test or question bank within a topic.
 */
export interface QuizItem {
    id: string;
    name: string;
    sectionType: SectionType;
    storagePath?: string; // Optional: Only needed for internal loading logic
    _sortOrder?: number;
    
    // For QBanks, they belong to a sub-category (e.g., "Gen Chem" inside Chemistry)
    qbCategory?: string; 
}

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