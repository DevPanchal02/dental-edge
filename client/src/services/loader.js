import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData as apiFetchQuizData,
} from './api.js';

// A simple in-memory cache to avoid re-fetching the structure of a topic.
const topicStructureCache = {};

/**
 * Fetches the list of all topics.
 */
export const fetchTopics = apiFetchTopics;

/**
 * Fetches the detailed structure of a topic (its lists of tests and banks).
 */
export const fetchTopicData = async (topicId) => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure;
  return structure;
};

/**
 * A helper function to find a specific quiz's metadata within a topic structure.
 */
const findQuizInStructure = (topicData, sectionType, quizId) => {
  if (!topicData) return null;
  if (sectionType === 'practice') {
    return topicData.practiceTests.find(pt => pt.id === quizId) || null;
  }
  if (sectionType === 'qbank') {
    for (const categoryGroup of topicData.questionBanks) {
      const bank = categoryGroup.banks.find(b => b.id === quizId);
      if (bank) {
        return { ...bank, actualQbCategory: categoryGroup.category };
      }
    }
  }
  return null;
};

/**
 * Retrieves the full JSON data for a specific quiz.
 * This function now correctly passes the required IDs to the API service.
 */
export const getQuizData = async (topicId, sectionType, quizId) => {
  // This function no longer needs to find the storagePath.
  // It simply validates that the quiz exists in the structure before calling the API.
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  // --- THIS IS THE FIX ---
  // Pass the correct arguments directly to the API function.
  return apiFetchQuizData(topicId, sectionType, quizId);
};

/**
 * Retrieves and formats metadata for the quiz page header and options modal.
 */
export const getQuizMetadata = async (topicId, sectionType, quizId) => {
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) return null;

  // We fetch the quiz data to accurately get the question count.
  const quizData = await getQuizData(topicId, sectionType, quizId);
  const totalQuestions = Array.isArray(quizData) ? quizData.filter(q => q && !q.error).length : 0;

  let fullNameForDisplay;
  let categoryForInstructions;
  const mainTopicName = topicData.name;

  if (sectionType === 'practice') {
    fullNameForDisplay = `${quizMeta.topicName} ${quizMeta.name}`;
    categoryForInstructions = quizMeta.topicName;
  } else { // QBank
    fullNameForDisplay = `${quizMeta.actualQbCategory} - ${quizMeta.name}`;
    if (quizMeta.actualQbCategory.toLowerCase() === quizMeta.name.toLowerCase()){
        fullNameForDisplay = quizMeta.name;
    }
    categoryForInstructions = quizMeta.actualQbCategory || quizMeta.name;
  }

  return {
    name: quizMeta.name,
    topicName: mainTopicName,
    fullNameForDisplay: fullNameForDisplay,
    categoryForInstructions: categoryForInstructions,
    totalQuestions: totalQuestions,
  };
};

/**
 * A utility function for formatting display names.
 */
export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ')
        .replace(/\.json$/i, '')
        .replace(/^\d+\s*/, '')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};