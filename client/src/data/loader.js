// FILE: client/src/data/loader.js (REVISED V11 - RC QB pathing and Passage Handling)
console.log("[Loader V11 - RC QB Pathing & Passage] Starting...");

const modules = import.meta.glob('/src/data/**/*.json', { eager: true });
console.log(`[Loader V11] Found ${Object.keys(modules).length} JSON modules.`);

const topicsData = {};

export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\.json$/i, '') // Remove .json extension
        .replace(/^\d+\s*/, '') // Remove leading numbers and space (e.g., "1_Biochemistry" -> "Biochemistry")
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
    const matchTest = fileName.match(/^(?:Test_)?(\d+)[_-]/i);
    if (matchTest) return parseInt(matchTest[1], 10);
    // For files like "1_Biochemistry.json" or "1_passage_whatever.json"
    const generalNumberMatch = fileName.match(/^(\d+)[_-]/);
    if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);
    return Infinity; // Default for non-numbered files
};


for (const path in modules) {
    const parts = path.split('/').filter(p => p && p !== 'src' && p !== 'data');

    // Basic validation: needs at least topicId, sectionTypeFolder, fileNameWithExt
    if (parts.length < 3) {
        // console.warn(`[Loader V11] Path too short, skipping: ${path}`);
        continue;
    }

    const topicId = parts[0];
    const sectionTypeFolder = parts[1]?.toLowerCase(); // 'practice-test' or 'question-bank'
    const quizDataModule = modules[path];

    if (!quizDataModule || !quizDataModule.default || !Array.isArray(quizDataModule.default) || quizDataModule.default.length === 0) {
        // console.warn(`[Loader V11] Invalid or empty quiz data for path: ${path}, skipping.`);
        continue;
    }
    const quizData = quizDataModule.default; // This is the array of questions

    const topicName = formatDisplayName(topicId);
    if (!topicsData[topicId]) {
        topicsData[topicId] = { id: topicId, name: topicName, practiceTests: [], questionBanks: {} };
    }

    const fileNameWithExt = parts[parts.length - 1];
    const currentQuizId = formatId(fileNameWithExt);

    // Attempt to get a more descriptive name from within the JSON if available
    const internalQuizBankNameField = quizData[0]?.question_bank; // e.g., "Practice Test 1" or "Biochemistry"
    const currentQuizName = internalQuizBankNameField ? formatDisplayName(internalQuizBankNameField) : formatDisplayName(fileNameWithExt);

    const totalQuestions = quizData.filter(q => q && !q.error).length;
    const currentSortOrder = getSortOrder(fileNameWithExt);
    const isTestFile = fileNameWithExt.toLowerCase().startsWith('test_');

    let classified = false;

    if (sectionTypeFolder === 'practice-test' && parts.length === 3 && isTestFile) {
        // Path: subject/practice-test/Test_X_Data.json
        const testNumberMatch = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : currentSortOrder;
        // For PTs, always use "Test X" format for consistency, internal name might be "Practice Test X"
        const practiceTestDisplayName = `Test ${testNumber}`;

        topicsData[topicId].practiceTests.push({
            id: currentQuizId,
            name: practiceTestDisplayName,
            path: path,
            data: quizData,
            totalQuestions: totalQuestions,
            _sortOrder: testNumber,
        });
        classified = true;

    } else if (sectionTypeFolder === 'question-bank') {
        let categoryName;
        let qbQuizName = currentQuizName; // Already determined from internal field or filename
        let qbSortOrder = currentSortOrder;
        let actualQuizId = currentQuizId;

        if (parts.length === 4) {
            // Path: subject/question-bank/category-folder/file.json
            categoryName = formatDisplayName(parts[2]); // Category from folder name
        } else if (parts.length === 3) {
            // Path: subject/question-bank/file.json (e.g., for Reading Comprehension QBs like "1_extra_reading_comp_practice_1.json")
            // Use internal "category" field (e.g., "Passage #1") if present for RC, otherwise default category.
            categoryName = formatDisplayName(quizData[0]?.category || topicId); // Default to topic name if no internal category
        }

        if (categoryName) {
            if (!topicsData[topicId].questionBanks[categoryName]) {
                topicsData[topicId].questionBanks[categoryName] = [];
            }
            topicsData[topicId].questionBanks[categoryName].push({
                id: actualQuizId,
                name: qbQuizName,
                path: path,
                data: quizData,
                totalQuestions: totalQuestions,
                _sortOrder: qbSortOrder,
            });
            classified = true;
        } else {
            // console.warn(`[Loader V11] QB path structure not recognized or categoryName missing for: ${path}`);
        }
    }

    if (!classified) {
        // console.warn(`[Loader V11] Unclassified path: ${path}. Parts: [${parts.join(', ')}]`);
    }
}

// Sort practice tests and question banks
Object.values(topicsData).forEach(topic => {
    if (topic.practiceTests) {
        topic.practiceTests.sort((a, b) => a._sortOrder - b._sortOrder);
    }
    if (topic.questionBanks) {
        const sortedCategories = Object.keys(topic.questionBanks).sort((a, b) => {
            const numA = parseInt(a.match(/^(\d+)/)?.[1] || a.match(/Passage #?(\d+)/i)?.[1]);
            const numB = parseInt(b.match(/^(\d+)/)?.[1] || b.match(/Passage #?(\d+)/i)?.[1]);

            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA) && isNaN(numB)) return -1;
            if (isNaN(numA) && !isNaN(numB)) return 1;
            return a.localeCompare(b);
        });
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

// API Functions (fetchTopics, fetchTopicData, getQuizData, getQuizMetadata)
// These remain largely the same as your V9/V10 but ensure they handle the 'data' field correctly.

export const fetchTopics = async () => {
    return Object.values(topicsData).map(({ id, name }) => ({ id, name }));
};

export const fetchTopicData = async (topicId) => {
    const topic = topicsData[topicId];
    if (!topic) throw new Error(`Topic '${topicId}' not found`);

    const questionBanksArray = Object.entries(topic.questionBanks || {}).map(([category, banks]) => ({
        category: category,
        banks: (banks || []).map(({ id, name, totalQuestions, data }) => ({
            id, name, totalQuestions,
            dataAvailable: !!data && data.length > 0
        })),
    }));

    return {
        id: topic.id,
        name: topic.name,
        practiceTests: (topic.practiceTests || []).map(({ id, name, totalQuestions, data }) => ({
            id, name, totalQuestions,
            dataAvailable: !!data && data.length > 0
        })),
        questionBanks: questionBanksArray,
    };
};

// getQuizData now returns the direct array of questions.
// The QuizPage component will be responsible for extracting passage from quizData[0].passage.html_content
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
    if (!quiz || !quiz.data) return null;
    return Array.isArray(quiz.data) ? quiz.data : []; // Return the array of questions
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
    if (!quizMeta || !quizMeta.data) return null;
    const totalQuestions = Array.isArray(quizMeta.data) ? quizMeta.data.filter(q => q && !q.error).length : 0;
    return { name: quizMeta.name, totalQuestions: totalQuestions };
};
