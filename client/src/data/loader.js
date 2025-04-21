// FILE: client/src/data/loader.js (REVISED V8 - Corrected 'question-bank' check)

console.log("[Loader V8 - Corrected QB Check] Starting...");

const modules = import.meta.glob('/src/data/**/*.json', { eager: true });
console.log(`[Loader V8] Found ${Object.keys(modules).length} JSON modules.`);

const topicsData = {};

// --- Helper Functions (Keep as before) ---
const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\.json$/i, '') // Remove .json extension
        .replace(/^\d+\s*/, '') // Remove leading numbers and space
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize words
};

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

// --- Process Modules ---
for (const path in modules) {
    // console.log(`\n[Loader V8] Processing path: ${path}`); // Keep commented unless needed

    const parts = path.split('/').filter(p => p && p !== 'src' && p !== 'data');
    // Lengths:
    // 2: Bio/Chem PT
    // 3: PA/RC PT
    // 4: Bio/Chem QB (parts[1] === 'question-bank')
    // 5: PA/RC QB (parts[2] === 'question-bank')

    if (parts.length < 2) {
        // console.warn(`[Loader V8]  -> Skipping path (too short): ${path}`);
        continue;
    }

    const topicId = parts[0];
    const topicName = formatDisplayName(topicId);
    const fileNameWithExt = parts[parts.length - 1];
    const quizData = modules[path].default;

    if (!quizData) {
        // console.warn(`[Loader V8]  -> Skipping path (no data): ${path}`);
        continue;
    }

    // Initialize topic if needed
    if (!topicsData[topicId]) {
        console.log(`[Loader V8]  -> Initializing topic: ${topicId}`);
        topicsData[topicId] = { id: topicId, name: topicName, practiceTests: [], questionBanks: {} };
    }

    const totalQuestions = Array.isArray(quizData) ? quizData.filter(q => q && !q.error).length : 0;
    const sortOrder = getSortOrder(fileNameWithExt);
    const quizId = formatId(fileNameWithExt);
    const quizName = formatDisplayName(fileNameWithExt);
    const lowerCaseFileName = fileNameWithExt.toLowerCase();
    const isTestFile = lowerCaseFileName.startsWith('test_');

    // --- Classification Logic (Corrected 'question-bank') ---
    let classified = false;
    // console.log(`[Loader V8]  -> Path Parts: ${JSON.stringify(parts)}, Length: ${parts.length}, IsTest: ${isTestFile}`); // Keep commented unless needed

    // 1. Check for Bio/Chem Practice Test (Depth 2)
    if (parts.length === 2 && isTestFile) {
        // console.log(`[Loader V8]  --> Classified as Practice Test (Style 1 - Bio/Chem): ${fileNameWithExt}`);
        const testNumberMatch = lowerCaseFileName.match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : sortOrder;
        topicsData[topicId].practiceTests.push({
            id: quizId, name: `Test ${testNumber}`, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: testNumber,
        });
        classified = true;
    }
    // 2. Check for PA/RC Practice Test (Depth 3)
    else if (!classified && parts.length === 3 && parts[1]?.toLowerCase() === 'practice-test' && isTestFile) {
        // console.log(`[Loader V8]  --> Classified as Practice Test (Style 2 - PA/RC): ${fileNameWithExt}`);
        const testNumberMatch = lowerCaseFileName.match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : sortOrder;
        topicsData[topicId].practiceTests.push({
            id: quizId, name: `Test ${testNumber}`, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: testNumber,
        });
        classified = true;
    }
    // 3. Check for Bio/Chem Question Bank (Depth 4)
    //    CORRECTED: Check for 'question-bank' (singular)
    else if (!classified && parts.length === 4 && parts[1]?.toLowerCase() === 'question-bank') {
        const categoryName = formatDisplayName(parts[2]); // Category is 3rd part (index 2)
        // console.log(`[Loader V8]  --> Classified as Question Bank (Style 1 - Bio/Chem): ${fileNameWithExt} in Category: ${categoryName}`);
        if (!topicsData[topicId].questionBanks[categoryName]) {
             // console.log(`[Loader V8]      Initializing category: ${categoryName}`);
            topicsData[topicId].questionBanks[categoryName] = [];
        }
        topicsData[topicId].questionBanks[categoryName].push({
            id: quizId, name: quizName, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: sortOrder,
        });
        classified = true;
    }
    // 4. Check for PA/RC Question Bank (Depth 5)
    //    CORRECTED: Check for 'question-bank' (singular) at index 2
    else if (!classified && parts.length === 5 && parts[1]?.toLowerCase() === 'practice-test' && parts[2]?.toLowerCase() === 'question-bank') {
        const categoryName = formatDisplayName(parts[3]); // Category is 4th part (index 3)
        // console.log(`[Loader V8]  --> Classified as Question Bank (Style 2 - PA/RC): ${fileNameWithExt} in Category: ${categoryName}`);
         if (!topicsData[topicId].questionBanks[categoryName]) {
            // console.log(`[Loader V8]      Initializing category: ${categoryName}`);
            topicsData[topicId].questionBanks[categoryName] = [];
        }
        topicsData[topicId].questionBanks[categoryName].push({
            id: quizId, name: quizName, path: path, data: quizData,
            totalQuestions: totalQuestions, _sortOrder: sortOrder,
        });
        classified = true;
    }

    // Log if no classification matched
    if (!classified) {
        console.warn(`[Loader V8]  -> *** Could not classify path: ${path} ***`);
        console.warn(`       Parts: ${JSON.stringify(parts)}, Length: ${parts.length}`);
        console.warn(`       parts[1]?.toLowerCase(): ${parts[1]?.toLowerCase()}`); // Log relevant parts for debugging
        console.warn(`       parts[2]?.toLowerCase(): ${parts[2]?.toLowerCase()}`);
        console.warn(`       IsTestFile: ${isTestFile}`);
    }
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

console.log("[Loader V8] Final processed topicsData:", JSON.stringify(topicsData, null, 2));

// --- API Functions (Keep as before) ---
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
    return Array.isArray(quiz.data) ? quiz.data.filter(q => q && !q.error) : [];
};
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
    const validQuestions = Array.isArray(quizMeta.data) ? quizMeta.data.filter(q => q && !q.error).length : 0;
    return { name: quizMeta.name, totalQuestions: validQuestions > 0 ? validQuestions : quizMeta.totalQuestions };
};