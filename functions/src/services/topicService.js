// FILE: functions/src/services/topicService.js

const admin = require("firebase-admin");
const { formatDisplayName, getSortOrder, formatId } = require("../utils/formatters");

const bucket = admin.storage().bucket();

/**
 * Scans the 'data/' folder to find all available topic folders.
 * @returns {Promise<Array>} List of topics { id, name }.
 */
const getAllTopics = async () => {
  const options = { prefix: "data/", delimiter: "/" };
  const [, , apiResponse] = await bucket.getFiles(options);
  const prefixes = apiResponse.prefixes || [];

  return prefixes.map((prefix) => {
    // prefix is like "data/biology/"
    const parts = prefix.slice(0, -1).split("/");
    const topicId = parts[parts.length - 1];
    return { id: topicId, name: formatDisplayName(topicId) };
  });
};

/**
 * Scans a specific topic folder to build the structure (Practice Tests vs QBanks).
 * @param {string} topicId 
 * @returns {Promise<object>} The structured data.
 */
const getTopicStructure = async (topicId) => {
  const [files] = await bucket.getFiles({ prefix: `data/${topicId}/` });
  
  const structure = {
    id: topicId,
    name: formatDisplayName(topicId),
    practiceTests: [],
    questionBanks: {},
  };

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
      
      structure.practiceTests.push({ 
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

      if (!structure.questionBanks[category]) {
        structure.questionBanks[category] = [];
      }
      
      structure.questionBanks[category].push({ 
        id: quizId, 
        name: formatDisplayName(fileNameWithExt), 
        storagePath: file.name, 
        _sortOrder: sortOrder, 
        qbCategory: category 
      });
    }
  }

  // Sorting Logic
  structure.practiceTests.sort((a, b) => a._sortOrder - b._sortOrder);
  
  const sortedCategories = Object.keys(structure.questionBanks).sort();
  const sortedBanksArray = sortedCategories.map(category => {
    structure.questionBanks[category].sort((a, b) => a._sortOrder - b._sortOrder);
    return {
      category,
      banks: structure.questionBanks[category].map(b => ({ ...b, sectionType: "qbank" }))
    };
  });

  structure.practiceTests = structure.practiceTests.map(pt => ({ ...pt, sectionType: "practice" }));
  structure.questionBanks = sortedBanksArray;

  return structure;
};

module.exports = {
  getAllTopics,
  getTopicStructure
};