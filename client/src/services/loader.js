// This file is now an "adapter" that connects the application's components
// to the backend API service. It ensures components can request data
// without needing to know the specific API endpoints or data-fetching logic.

import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData as apiFetchQuizData,
} from './api.js';

// A simple in-memory cache to avoid re-fetching the structure of a topic
// every time we need metadata or quiz data.
const topicStructureCache = {};

/**
 * Fetches the list of all topics.
 * This function simply passes the call through to the API service.
 */
export const fetchTopics = apiFetchTopics;

/**
 * Fetches the detailed structure of a topic (its lists of tests and banks).
 * It uses the cache to avoid redundant network requests.
 * @param {string} topicId - The ID of the topic.
 * @returns {Promise<Object>} The topic structure data.
 */
export const fetchTopicData = async (topicId) => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure; // Cache the result
  return structure;
};

/**
 * A helper function to find a specific quiz's metadata within a topic structure.
 * @param {Object} topicData - The full, cached topic structure.
 * @param {string} sectionType - 'practice' or 'qbank'.
 * @param {string} quizId - The ID of the quiz.
 * @returns {Object|null} The metadata object for the quiz, or null if not found.
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
        // Return the bank with its parent category's name for context
        return { ...bank, actualQbCategory: categoryGroup.category };
      }
    }
  }
  return null;
};

/**
 * Retrieves the full JSON data for a specific quiz.
 * This is now an async function as it fetches data from the network.
 * @param {string} topicId - The ID of the topic.
 * @param {string} sectionType - 'practice' or 'qbank'.
 * @param {string} quizId - The ID of the quiz.
 * @returns {Promise<Array<Object>>} A promise that resolves to the array of question objects.
 */
export const getQuizData = async (topicId, sectionType, quizId) => {
  const topicData = await fetchTopicData(topicId); // Ensures structure is cached
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  // Use the storagePath to fetch the actual quiz data from the secure API
  return apiFetchQuizData(quizMeta.storagePath);
};


/**
 * Retrieves and formats metadata for the quiz page header and options modal.
 * This is also now async.
 * @param {string} topicId - The ID of the topic.
 * @param {string} sectionType - 'practice' or 'qbank'.
 * @param {string} quizId - The ID of the quiz.
 * @returns {Promise<Object>} A promise resolving to the formatted metadata.
 */
export const getQuizMetadata = async (topicId, sectionType, quizId) => {
  const topicData = await fetchTopicData(topicId); // Ensure structure is cached
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) return null;

  const quizData = await getQuizData(topicId, sectionType, quizId);
  const totalQuestions = Array.isArray(quizData) ? quizData.filter(q => q && !q.error).length : 0;

  let fullNameForDisplay;
  let categoryForInstructions;
  const mainTopicName = topicData.name; // e.g., "Biology"

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
 * A utility function for formatting display names, which can still be useful on the frontend.
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