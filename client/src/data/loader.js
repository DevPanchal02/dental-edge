// FILE: client/src/data/loader.js (REVISED V9 - Exported formatDisplayName)

console.log("[Loader V9 - Exported Helpers] Starting..."); // Updated version marker

const modules = import.meta.glob('/src/data/**/*.json', { eager: true });
console.log(`[Loader V9] Found ${Object.keys(modules).length} JSON modules.`);

const topicsData = {};

// --- Helper Functions ---
// ADD 'export' keyword here
export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\.json$/i, '') // Remove .json extension
        .replace(/^\d+\s*/, '') // Remove leading numbers and space
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize words
};

// formatId and getSortOrder do not need to be exported currently
const formatId = (rawName) => {
    if (!rawName) return '';
    const baseName = rawName.replace(/\.json$/i, ''); // Remove extension first
    return baseName
        .toLowerCase()
        .replace(/\s+/g, '-') // Spaces to hyphens
        .replace(/[^a-z0-9-]+/g, '') // Remove invalid URL chars
        .replace(/-+/g,'-') // Collapse multiple hyphens
        .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
};

const getSortOrder = (fileName) => {
    // Match Test_NUMBER_ or just NUMBER_
    const match = fileName.match(/^(?:Test_)?(\d+)[_-]/i);
    return match ? parseInt(match[1], 10) : Infinity;
};
// --- End Helper Functions ---

// --- Process Modules (Keep same logic as V8) ---
for (const path in modules) {
    // console.log(`\n[Loader V9] Processing path: ${path}`); // Keep commented unless needed

    const parts = path.split('/').filter(p => p && p !== 'src' && p !== 'data');
    if (parts.length < 2) continue;

    const topicId = parts[0];
    const topicName = formatDisplayName(topicId); // Use the helper
    const fileNameWithExt = parts[parts.length - 1];
    const quizData = modules[path].default;
    if (!quizData) continue;

    if (!topicsData[topicId]) {
        // console.log(`[Loader V9]  -> Initializing topic: ${topicId}`);
        topicsData[topicId] = { id: topicId, name: topicName, practiceTests: [], questionBanks: {} };
    }

    const totalQuestions = Array.isArray(quizData) ? quizData.filter(q => q && !q.error).length : 0;
    const sortOrder = getSortOrder(fileNameWithExt);
    const quizId = formatId(fileNameWithExt);
    const quizName = formatDisplayName(fileNameWithExt); // Use the helper
    const lowerCaseFileName = fileNameWithExt.toLowerCase();
    const isTestFile = lowerCaseFileName.startsWith('test_');

    let classified = false;

    // Condition 1: Bio/Chem PT
    if (parts.length === 2 && isTestFile) {
        const testNumberMatch = lowerCaseFileName.match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : sortOrder;
        topicsData[topicId].practiceTests.push({
            id: quizId, name: `Test ${testNumber}`, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: testNumber,
        });
        classified = true;
    }
    // Condition 2: PA/RC PT
    else if (!classified && parts.length === 3 && parts[1]?.toLowerCase() === 'practice-test' && isTestFile) {
        const testNumberMatch = lowerCaseFileName.match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : sortOrder;
        topicsData[topicId].practiceTests.push({
            id: quizId, name: `Test ${testNumber}`, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: testNumber,
        });
        classified = true;
    }
    // Condition 3: Bio/Chem QB
    else if (!classified && parts.length === 4 && parts[1]?.toLowerCase() === 'question-bank') { // Corrected check
        const categoryName = formatDisplayName(parts[2]);
        if (!topicsData[topicId].questionBanks[categoryName]) {
            topicsData[topicId].questionBanks[categoryName] = [];
        }
        topicsData[topicId].questionBanks[categoryName].push({
            id: quizId, name: quizName, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: sortOrder,
        });
        classified = true;
    }
    // Condition 4: PA/RC QB
    else if (!classified && parts.length === 5 && parts[1]?.toLowerCase() === 'practice-test' && parts[2]?.toLowerCase() === 'question-bank') { // Corrected check
        const categoryName = formatDisplayName(parts[3]);
         if (!topicsData[topicId].questionBanks[categoryName]) {
            topicsData[topicId].questionBanks[categoryName] = [];
        }
        topicsData[topicId].questionBanks[categoryName].push({
            id: quizId, name: quizName, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: sortOrder,
        });
        classified = true;
    }

    // if (!classified) {
    //     console.warn(`[Loader V9]  -> Could not classify path: ${path}`);
    // }
}
// --- End Process Modules ---

// --- Sort Items ---
Object.values(topicsData).forEach(topic => {
    if (topic.practiceTests) {
        topic.practiceTests.sort((a, b) => a._sortOrder - b._sortOrder);
    }
    if (topic.questionBanks) {
        const sortedCategories = Object.keys(topic.questionBanks).sort((a, b) => a.localeCompare(b));
        const sortedQuestionBanks = {};
        for (const category of sortedCategories) {
            if (topic.questionBanks[category]) {
                topic.questionBanks[category].sort((a, b) => a._sortOrder - b._sortOrder);
                sortedQuestionBanks[category] = topic.questionBanks[category];
            }
        }
        topic.questionBanks = sortedQuestionBanks;
    }
});
// --- End Sort Items ---

// console.log("[Loader V9] Final processed topicsData:", JSON.stringify(topicsData, null, 2)); // Keep commented unless needed

// --- API Functions ---
export const fetchTopics = async () => {
    return Object.values(topicsData).map(({ id, name }) => ({ id, name }));
};
export const fetchTopicData = async (topicId) => {
    const topic = topicsData[topicId];
    if (!topic) throw new Error(`Topic '${topicId}' not found`);
    const questionBanksArray = Object.entries(topic.questionBanks || {}).map(([category, banks]) => ({
        category: category,
        banks: (banks || []).map(({ id, name, totalQuestions, data }) => ({
            id, name, totalQuestions, dataAvailable: !!data
        })),
    }));
    return {
        id: topic.id,
        name: topic.name,
        practiceTests: (topic.practiceTests || []).map(({ id, name, totalQuestions, data }) => ({
            id, name, totalQuestions, dataAvailable: !!data
        })),
        questionBanks: questionBanksArray,
    };
};
// Return ALL data, including potential errors, for results page calculation
export const getQuizData = (topicId, sectionType, quizId) => {
    const topic = topicsData[topicId];
    if (!topic) return null;
    let quiz = null;
    if (sectionType === 'practice' && topic.practiceTests) {
        quiz = topic.practiceTests.find(t => t.id === quizId);
    } else if (sectionType === 'qbank' && topic.questionBanks) {
        for (const category in topic.questionBanks) {
            const bank = topic.questionBanks[category]?.find(b => b.id === quizId);
            if (bank) { quiz = bank; break; }
        }
    }
    if (!quiz) return null;
    return Array.isArray(quiz.data) ? quiz.data : []; // Return raw data
};
// Return total count based on raw data length
export const getQuizMetadata = (topicId, sectionType, quizId) => {
     const topic = topicsData[topicId];
     if (!topic) return null;
    let quizMeta = null;
    if (sectionType === 'practice' && topic.practiceTests) {
        quizMeta = topic.practiceTests.find(t => t.id === quizId);
    } else if (sectionType === 'qbank' && topic.questionBanks) {
        for (const category in topic.questionBanks) {
            const bank = topic.questionBanks[category]?.find(b => b.id === quizId);
            if (bank) { quizMeta = bank; break; }
        }
    }
    if (!quizMeta) return null;
    const totalQuestions = Array.isArray(quizMeta.data) ? quizMeta.data.length : 0; // Use raw length
    return { name: quizMeta.name, totalQuestions: totalQuestions };
};