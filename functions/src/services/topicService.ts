import { bucket } from '../firebase';
import { formatDisplayName, formatId, getSortOrder } from '../utils/formatters';
import { TopicSummary, TopicStructure, QuizItem, QuestionBankGroup } from '../types/models.types';

// Define the shape we expect from the Google Cloud Storage API when using 'delimiter'
interface GCSResponse {
    prefixes?: string[];
}

/**
 * Scans the 'data/' folder to find all available topic folders.
 */
export const getAllTopics = async (): Promise<TopicSummary[]> => {
    const options = { prefix: "data/", delimiter: "/" };
    const [, , apiResponse] = await bucket.getFiles(options);
    
    // Cast the raw response to our defined interface so TS knows 'prefixes' exists
    const response = apiResponse as GCSResponse;
    const prefixes = response.prefixes || [];

    return prefixes.map((prefix: string) => {
        // prefix is like "data/biology/"
        const parts = prefix.slice(0, -1).split("/");
        const topicId = parts[parts.length - 1];
        return { id: topicId, name: formatDisplayName(topicId) };
    });
};

/**
 * Scans a specific topic folder to build the structure (Practice Tests vs QBanks).
 */
export const getTopicStructure = async (topicId: string): Promise<TopicStructure> => {
    const [files] = await bucket.getFiles({ prefix: `data/${topicId}/` });

    // Initialize with specific typing
    const practiceTests: QuizItem[] = [];
    const questionBanksDict: Record<string, QuizItem[]> = {};

    for (const file of files) {
        if (!file.name.endsWith(".json")) continue;

        // path: data/biology/practice-test/Test_1.json
        const parts = file.name.split("/").filter((p) => p);
        if (parts.length < 4) continue;

        const sectionTypeFolder = parts[2];
        const fileNameWithExt = parts[parts.length - 1];
        const sortOrder = getSortOrder(fileNameWithExt);

        if (sectionTypeFolder === "practice-test" && fileNameWithExt.toLowerCase().startsWith("test_")) {
            const match = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
            const num = match ? parseInt(match[1], 10) : sortOrder;

            practiceTests.push({
                id: `test-${num}`,
                name: `Test ${num}`,
                storagePath: file.name,
                _sortOrder: sortOrder,
                topicName: formatDisplayName(topicId)
            });

        } else if (sectionTypeFolder === "question-bank") {
            // path: data/chemistry/question-bank/General_Chemistry/Acids_Bases.json
            const quizId = formatId(fileNameWithExt);
            const category = (parts.length > 4) ? formatDisplayName(parts[3]) : formatDisplayName(topicId);

            if (!questionBanksDict[category]) {
                questionBanksDict[category] = [];
            }

            questionBanksDict[category].push({
                id: quizId,
                name: formatDisplayName(fileNameWithExt),
                storagePath: file.name,
                _sortOrder: sortOrder,
                qbCategory: category
            });
        }
    }

    // Sorting Logic
    practiceTests.sort((a, b) => (a._sortOrder || 0) - (b._sortOrder || 0));

    const sortedCategories = Object.keys(questionBanksDict).sort();
    
    // Explicitly type the mapped array to match the Interface
    const sortedBanksArray: QuestionBankGroup[] = sortedCategories.map(category => {
        const banks = questionBanksDict[category];
        banks.sort((a, b) => (a._sortOrder || 0) - (b._sortOrder || 0));
        return {
            category,
            banks: banks
        };
    });

    return {
        id: topicId,
        name: formatDisplayName(topicId),
        practiceTests, 
        questionBanks: sortedBanksArray
    };
};