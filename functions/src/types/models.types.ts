import { Timestamp } from 'firebase-admin/firestore';

export type UserTier = 'free' | 'plus' | 'pro';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    tier: UserTier;
    stripeCustomerId?: string | null;
    createdAt?: Timestamp;
}

export interface TopicSummary {
    id: string;
    name: string;
}

export interface QuizItem {
    id: string;
    name: string;
    storagePath: string;
    _sortOrder?: number;
    qbCategory?: string;
    topicName?: string;
}

export interface QuestionBankGroup {
    category: string;
    banks: QuizItem[];
}

export interface TopicStructure {
    id: string;
    name: string;
    practiceTests: QuizItem[];
    questionBanks: QuestionBankGroup[]; 
}