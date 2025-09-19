// FILE: client/src/services/loader.js

import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  // We only import the new unified fetcher
  fetchQuizData,
} from './api.js';
import { auth } from '../firebase';

const topicStructureCache = {};

// fetchTopics remains the same
export const fetchTopics = apiFetchTopics;

// fetchTopicData remains the same
export const fetchTopicData = async (topicId) => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure;
  return structure;
};

// findQuizInStructure remains the same
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

// --- REFACTORED getQuizData ---
// This function is now much simpler. Its only job is to find the correct
// storage path and then call the unified API endpoint.
export const getQuizData = async (topicId, sectionType, quizId) => {
  // Determine if this is an unregistered preview request on the client-side
  const isPreview = !auth.currentUser && topicId === 'biology' && sectionType === 'practice' && quizId === 'test-1';

  // Find the metadata, which contains the crucial `storagePath`
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  // Call the single, unified fetcher from api.js
  // It will handle sending the token and the isPreview flag correctly.
  return fetchQuizData(quizMeta.storagePath, isPreview);
};


// getQuizMetadata remains the same
export const getQuizMetadata = async (topicId, sectionType, quizId) => {
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) return null;

  let fullNameForDisplay;
  let categoryForInstructions;
  const mainTopicName = topicData.name;

  if (sectionType === 'practice') {
    fullNameForDisplay = `${quizMeta.topicName} ${quizMeta.name}`;
    categoryForInstructions = quizMeta.topicName;
  } else {
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
  };
};

// formatDisplayName remains the same
export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ')
        .replace(/\.json$/i, '')
        .replace(/^\d+\s*/, '')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};