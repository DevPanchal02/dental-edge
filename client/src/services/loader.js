// FILE: client/src/services/loader.js

import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizPreview,
  fetchFreeContent,
  fetchPaidContent,
} from './api.js';
import { auth } from '../firebase';

const topicStructureCache = {};

export const fetchTopics = apiFetchTopics;

export const fetchTopicData = async (topicId) => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure;
  return structure;
};

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

export const getQuizData = async (topicId, sectionType, quizId) => {
  const isPreview = !auth.currentUser && topicId === 'biology' && sectionType === 'practice' && quizId === 'test-1';

  if (isPreview) {
    return fetchQuizPreview();
  }

  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  let isFreeContent = false;
  if (sectionType === 'practice' && topicData.practiceTests[0]?.id === quizId) {
    isFreeContent = true;
  } else if (sectionType === 'qbank') {
      for(const category of topicData.questionBanks) {
          if (category.banks[0]?.id === quizId) {
              isFreeContent = true;
              break;
          }
      }
  }

  if (isFreeContent) {
    return fetchFreeContent(quizMeta.storagePath);
  } else {
    return fetchPaidContent(quizMeta.storagePath);
  }
};

/**
 * Retrieves METADATA ONLY. Does not fetch full quiz data.
 */
export const getQuizMetadata = async (topicId, sectionType, quizId) => {
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) return null;

  // --- THIS IS THE FIX ---
  // We no longer fetch quizData here. We only return the metadata we have.
  // The question count will be determined in the component.

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
    // totalQuestions will be added by the QuizPage component.
  };
};

export const formatDisplayName = (rawName) => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ')
        .replace(/\.json$/i, '')
        .replace(/^\d+\s*/, '')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};
