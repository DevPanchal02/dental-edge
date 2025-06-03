// FILE: client/src/data/loader.js
// console.log("[Loader V11.2 - Meta for PT Options] Starting..."); // Version bump for clarity

const modules = import.meta.glob('/src/data/**/*.json', { eager: true });
// console.log(`[Loader V11.2] Found ${Object.keys(modules).length} JSON modules.`);

const topicsData = {};

export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ')
        .replace(/\.json$/i, '')
        .replace(/^\d+\s*/, '')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};

const formatId = (rawName) => {
    if (!rawName) return '';
    const baseName = rawName.replace(/\.json$/i, '');
    return baseName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]+/g, '')
        .replace(/-+/g,'-')
        .replace(/^-+|-+$/g, '');
};

const getSortOrder = (fileName) => {
    const matchTest = fileName.match(/^(?:Test_)?(\d+)[_-]/i);
    if (matchTest) return parseInt(matchTest[1], 10);
    const generalNumberMatch = fileName.match(/^(\d+)[_-]/);
    if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);
    return Infinity;
};


for (const path in modules) {
    const parts = path.split('/').filter(p => p && p !== 'src' && p !== 'data');

    if (parts.length < 3) {
        continue;
    }

    const topicIdFromFile = parts[0];
    const sectionTypeFolder = parts[1]?.toLowerCase();
    const quizDataModule = modules[path];

    if (!quizDataModule || !quizDataModule.default || !Array.isArray(quizDataModule.default) || quizDataModule.default.length === 0) {
        continue;
    }
    const quizData = quizDataModule.default;

    const topicNameFormatted = formatDisplayName(topicIdFromFile);
    if (!topicsData[topicIdFromFile]) {
        topicsData[topicIdFromFile] = { id: topicIdFromFile, name: topicNameFormatted, practiceTests: [], questionBanks: {} };
    }

    const fileNameWithExt = parts[parts.length - 1];
    const currentQuizId = formatId(fileNameWithExt);
    
    const internalQuizBankNameField = quizData[0]?.question_bank;
    // For PTs, we want "Test X", for QBs, use internal or filename.
    let currentQuizNameResolved;
    if (sectionTypeFolder === 'practice-test' && fileNameWithExt.toLowerCase().startsWith('test_')) {
        const testNumberMatch = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
        const testNumber = testNumberMatch ? parseInt(testNumberMatch[1], 10) : getSortOrder(fileNameWithExt);
        currentQuizNameResolved = `Test ${testNumber}`;
    } else {
        currentQuizNameResolved = internalQuizBankNameField ? formatDisplayName(internalQuizBankNameField) : formatDisplayName(fileNameWithExt);
    }


    const totalQuestions = quizData.filter(q => q && !q.error).length;
    const currentSortOrder = getSortOrder(fileNameWithExt);
    const isTestFile = fileNameWithExt.toLowerCase().startsWith('test_');

    let classified = false;

    if (sectionTypeFolder === 'practice-test' && parts.length === 3 && isTestFile) {
        topicsData[topicIdFromFile].practiceTests.push({
            id: currentQuizId,
            name: currentQuizNameResolved, // e.g., "Test 1"
            topicName: topicNameFormatted, // e.g., "Biology" - This is the category for PTs
            path: path,
            data: quizData,
            totalQuestions: totalQuestions,
            _sortOrder: currentSortOrder, // Use sort order derived from filename
        });
        classified = true;

    } else if (sectionTypeFolder === 'question-bank') {
        let categoryName;
        // For QBs, the category name is either the subfolder or from the JSON file.
        if (parts.length === 4) { // subject/question-bank/category-folder/file.json
            categoryName = formatDisplayName(parts[2]);
        } else if (parts.length === 3) { // subject/question-bank/file.json
            categoryName = formatDisplayName(quizData[0]?.category || topicNameFormatted); // Default to topic name if no internal category
        }

        if (categoryName) {
            if (!topicsData[topicIdFromFile].questionBanks[categoryName]) {
                topicsData[topicIdFromFile].questionBanks[categoryName] = [];
            }
            topicsData[topicIdFromFile].questionBanks[categoryName].push({
                id: currentQuizId,
                name: currentQuizNameResolved, // This is the actual name of the QB quiz
                topicName: topicNameFormatted, // The main topic it falls under
                qbCategory: categoryName, // The specific category for this QB
                path: path,
                data: quizData,
                totalQuestions: totalQuestions,
                _sortOrder: currentSortOrder,
            });
            classified = true;
        }
    }
}

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

export const fetchTopics = async () => {
    return Object.values(topicsData).map(({ id, name }) => ({ id, name }));
};

export const fetchTopicData = async (topicId) => {
    const topic = topicsData[topicId];
    if (!topic) throw new Error(`Topic '${topicId}' not found`);

    const questionBanksArray = Object.entries(topic.questionBanks || {}).map(([category, banks]) => ({
        category: category, // This is the QBank category (e.g., "Acids and Bases", "Passage 1")
        banks: (banks || []).map(({ id, name, totalQuestions, data }) => ({
            id, name, totalQuestions,
            dataAvailable: !!data && data.length > 0
        })),
    }));

    return {
        id: topic.id,
        name: topic.name, // This is the main topic name (e.g., "Biology")
        practiceTests: (topic.practiceTests || []).map(({ id, name, totalQuestions, data, topicName }) => ({
            id, name, totalQuestions,
            categoryName: topicName, // For PTs, categoryName is the topicName like "Biology"
            dataAvailable: !!data && data.length > 0
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
    if (!quiz || !quiz.data) return null;
    return Array.isArray(quiz.data) ? quiz.data : [];
};

export const getQuizMetadata = (topicId, sectionType, quizId) => {
     const topic = topicsData[topicId];
     if (!topic) return null;
    let quizMeta = null;

    if (sectionType === 'practice' && topic.practiceTests) {
        quizMeta = topic.practiceTests.find(t => t.id === quizId);
    } else if (sectionType === 'qbank' && topic.questionBanks) {
        for (const categoryKey in topic.questionBanks) { // Renamed to avoid conflict
            const bank = topic.questionBanks[categoryKey]?.find(b => b.id === quizId);
            if (bank) {
                quizMeta = { ...bank, actualQbCategory: categoryKey }; // Add the actual QBank category
                break;
            }
        }
    }

    if (!quizMeta || !quizMeta.data) return null;
    const totalQuestions = Array.isArray(quizMeta.data) ? quizMeta.data.filter(q => q && !q.error).length : 0;
    
    let fullNameForDisplay;
    let categoryForInstructions;
    const mainTopicName = topic.name; // e.g., "Biology"

    if (sectionType === 'practice') {
        // quizMeta.name is "Test X", quizMeta.topicName is the category like "Biology"
        fullNameForDisplay = `${quizMeta.topicName} ${quizMeta.name}`; // e.g., "Biology Test 1"
        categoryForInstructions = quizMeta.topicName; // e.g., "Biology" for "Biology questions"
    } else { // QBank
        // quizMeta.name is the specific QBank name e.g., "Acids & Bases"
        // quizMeta.actualQbCategory is the category it's filed under e.g. "General Chemistry Principles" or "Acids & Bases"
        // quizMeta.topicName is the overall topic e.g. "General Chemistry"
        fullNameForDisplay = `${quizMeta.actualQbCategory} - ${quizMeta.name}`;
        if (quizMeta.actualQbCategory.toLowerCase() === quizMeta.name.toLowerCase()){ // Avoid "Acids & Bases - Acids & Bases"
            fullNameForDisplay = quizMeta.name;
        }
        categoryForInstructions = quizMeta.actualQbCategory || quizMeta.name; // e.g. "Acids & Bases questions"
    }

    return {
        name: quizMeta.name, // Original short name: "Test 1" or "Acids & Bases"
        topicName: mainTopicName, // Main topic: "Biology", "General Chemistry"
        fullNameForDisplay: fullNameForDisplay, // "Biology Test 1" or "General Chemistry Principles - Acids & Bases"
        categoryForInstructions: categoryForInstructions, // "Biology" or "Acids & Bases" (for the sentence)
        totalQuestions: totalQuestions
    };
};