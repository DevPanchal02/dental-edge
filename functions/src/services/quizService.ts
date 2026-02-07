import { bucket } from '../firebase';
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { formatId } from '../utils/formatters';
import { Question } from '../schemas/quiz.schemas';

/**
 * Finds the full Google Cloud Storage path for a given quiz.
 */
export const findQuizStoragePath = async (topicId: string, quizId: string): Promise<string | null> => {
    if (!topicId || !quizId) return null;

    try {
        const [allFiles] = await bucket.getFiles({ prefix: `data/${topicId}/` });

        for (const file of allFiles) {
            const parts = file.name.split("/").filter(Boolean);
            if (parts.length < 4) continue;

            let currentFileQuizId: string | null = null;
            const fileName = parts[parts.length - 1];
            const sectionType = parts[2];

            if (sectionType === "practice-test") {
                const match = fileName.toLowerCase().match(/test_(\d+)/);
                if (match) {
                    currentFileQuizId = `test-${match[1]}`;
                }
            } else if (sectionType === "question-bank") {
                currentFileQuizId = formatId(fileName);
            }

            if (currentFileQuizId && currentFileQuizId === quizId) {
                return file.name;
            }
        }
    } catch (err: any) {
        logger.error("Error finding quiz storage path", err);
    }
    return null;
};

/**
 * Downloads and parses the full quiz data from storage.
 */
export const getFullQuizData = async (storagePath: string): Promise<Question[]> => {
    try {
        const [quizDataBuffer] = await bucket.file(storagePath).download();
        const jsonString = quizDataBuffer.toString();
        const parsed = JSON.parse(jsonString);

        // Normalize data: If it's wrapped in { questions: [] }, extract it.
        if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
            return parsed.questions as Question[];
        }
        return (Array.isArray(parsed) ? parsed : []) as Question[];
    } catch (error: any) {
        logger.error("Failed to download or parse quiz data", { storagePath, error: error.message });
        throw new HttpsError("internal", "Could not retrieve quiz data.");
    }
};

/**
 * Calculates a user's score based on their answers.
 */
export const calculateScore = (userAnswers: Record<number, string>, allQuizQuestions: Question[]): number => {
    if (!userAnswers || !Array.isArray(allQuizQuestions)) return 0;

    let score = 0;
    allQuizQuestions.forEach((question, index) => {
        if (!question || !question.options || !Array.isArray(question.options)) return;

        const correctOption = question.options.find((opt) => opt.is_correct);
        // Strict comparison of label strings
        if (correctOption && userAnswers[index] === correctOption.label) {
            score++;
        }
    });
    return score;
};

/**
 * Retrieves only the analytics portion of a quiz's data.
 */
export const getQuizAnalytics = async (storagePath: string): Promise<Partial<Question>[]> => {
    try {
        const fullQuizData = await getFullQuizData(storagePath);

        if (!Array.isArray(fullQuizData)) return [];

        return fullQuizData.map((q) => {
            if (!q) return { analytics: { percent_correct: '0' }, category: "Unknown", options: [] }; // Return fallback matching schema partials

            return {
                analytics: q.analytics || { percent_correct: '0' },
                category: q.category || "General",
                options: Array.isArray(q.options)
                    ? q.options.map((opt) => ({
                        label: opt.label || "?",
                        html_content: '', // Minimal data for analytics
                        is_correct: !!opt.is_correct,
                    }))
                    : []
            };
        });
    } catch (error) {
        logger.error(`Error generating analytics for ${storagePath}:`, error);
        return [];
    }
};