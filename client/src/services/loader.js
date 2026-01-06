// FILE: client/src/services/loader.js

import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData,
} from './api.js';
import { auth } from '../firebase';

const topicStructureCache = {};

// --- Utility: Clean Highlights from Raw Data ---
export const cleanPassageHtml = (htmlString) => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    
    // 1. Remove raw data highlights (class="highlighted")
    let cleanedHtml = htmlString.replace(/<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
    
    // 2. Remove the MUI button artifacts if present in raw data
    const MuiButtonRegex = /<button\s+class="MuiButtonBase-root[^"]*"[^>]*data-testid="highlighter-button-id"[^>]*>[\s\S]*?<\/button>/gi;
    cleanedHtml = cleanedHtml.replace(MuiButtonRegex, '');
    
    // 3. Remove any remaining generic mark tags to be safe
    // Note: We perform this cleaning ONCE when loading raw data. 
    // We do NOT perform this on user-saved states (which contain custom-highlight).
    cleanedHtml = cleanedHtml.replace(/<mark[^>]*>/gi, '').replace(/<\/mark>/gi, '');
    
    return cleanedHtml;
};

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
export const getQuizData = async (topicId, sectionType, quizId) => {
  // Determine if this is an unregistered preview request on the client-side
  const isPreview = !auth.currentUser && topicId === 'biology' && sectionType === 'practice' && quizId === 'test-1';

  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  const rawData = await fetchQuizData(quizMeta.storagePath, isPreview);

  // --- CLEANING STEP ---
  // We clean the passage HTML immediately upon load to remove raw-data highlights.
  if (Array.isArray(rawData)) {
      return rawData.map(q => {
          if (q.passage && q.passage.html_content) {
              return {
                  ...q,
                  passage: {
                      ...q.passage,
                      html_content: cleanPassageHtml(q.passage.html_content)
                  }
              };
          }
          return q;
      });
  }
  
  return rawData;
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
