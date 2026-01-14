import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData,
} from './api';
import { auth } from '../firebase';
import { TopicStructure, QuizItem} from '../types/content.types';
import { Question, QuizMetadata } from '../types/quiz.types';

// We explicitly type the cache dictionary
const topicStructureCache: Record<string, TopicStructure> = {};

// --- Utility: Clean Highlights from Raw Data ---
export const cleanPassageHtml = (htmlString: string | undefined): string => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    
    // 1. Remove raw data highlights (class="highlighted")
    let cleanedHtml = htmlString.replace(/<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
    
    // 2. Remove the MUI button artifacts if present in raw data
    const MuiButtonRegex = /<button\s+class="MuiButtonBase-root[^"]*"[^>]*data-testid="highlighter-button-id"[^>]*>[\s\S]*?<\/button>/gi;
    cleanedHtml = cleanedHtml.replace(MuiButtonRegex, '');
    
    // 3. Remove any remaining generic mark tags to be safe
    cleanedHtml = cleanedHtml.replace(/<mark[^>]*>/gi, '').replace(/<\/mark>/gi, '');
    
    return cleanedHtml;
};

// Re-export fetchTopics with its type
export const fetchTopics = apiFetchTopics;

export const fetchTopicData = async (topicId: string): Promise<TopicStructure> => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure;
  return structure;
};

const findQuizInStructure = (topicData: TopicStructure | null, sectionType: string, quizId: string): QuizItem | null => {
  if (!topicData) return null;
  
  if (sectionType === 'practice') {
    return topicData.practiceTests.find(pt => pt.id === quizId) || null;
  }
  
  if (sectionType === 'qbank') {
    for (const categoryGroup of topicData.questionBanks) {
      const bank = categoryGroup.banks.find(b => b.id === quizId);
      if (bank) {
        // We inject the category for display purposes, ensuring it fits the QuizItem type
        return { ...bank, qbCategory: categoryGroup.category };
      }
    }
  }
  return null;
};

// --- REFACTORED getQuizData ---
export const getQuizData = async (topicId: string, sectionType: string, quizId: string, isPreviewMode: boolean = false): Promise<Question[]> => {
  // Determine if this is an unregistered preview request on the client-side
  // We use explicit strict equality checks
  const isPreview = isPreviewMode || (!auth.currentUser && topicId === 'biology' && sectionType === 'practice' && quizId === 'test-1');

  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  // fetchQuizData returns any[], so we cast/map it to strict Question[]
  const rawData = await fetchQuizData(quizMeta.storagePath, isPreview);

  // Helper to ensure data format
  let questionsArray: any[] = [];
  if (Array.isArray(rawData)) {
      questionsArray = rawData;
  } else if (rawData && typeof rawData === 'object' && 'questions' in rawData && Array.isArray((rawData as any).questions)) {
      questionsArray = (rawData as any).questions;
  }

  // Clean the data and cast to Question type
  return questionsArray.map((q: any) => {
      const question: Question = { ...q }; // Shallow copy
      
      if (question.passage && question.passage.html_content) {
          question.passage = {
              ...question.passage,
              html_content: cleanPassageHtml(question.passage.html_content)
          };
      }
      return question;
  });
};


export const getQuizMetadata = async (topicId: string, sectionType: string, quizId: string): Promise<QuizMetadata | null> => {
  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta) return null;

  let fullNameForDisplay: string;
  let categoryForInstructions: string;
  const mainTopicName = topicData.name;

  if (sectionType === 'practice') {
    // We assume quizMeta.name exists based on QuizItem type
    fullNameForDisplay = `${mainTopicName} ${quizMeta.name}`;
    categoryForInstructions = mainTopicName;
  } else {
    // qbCategory is optional in QuizItem, so we fallback to name if missing (though logic ensures it exists)
    const category = quizMeta.qbCategory || quizMeta.name;
    fullNameForDisplay = `${category} - ${quizMeta.name}`;
    
    if (category.toLowerCase() === quizMeta.name.toLowerCase()){
        fullNameForDisplay = quizMeta.name;
    }
    categoryForInstructions = category;
  }

  return {
    name: quizMeta.name,
    topicName: mainTopicName,
    fullNameForDisplay,
    categoryForInstructions,
  };
};

export const formatDisplayName = (rawName: string | undefined): string => {
    if (!rawName) return '';
    return rawName
        .replace(/[-_]/g, ' ')
        .replace(/\.json$/i, '')
        .replace(/^\d+\s*/, '')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};