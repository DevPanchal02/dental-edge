import DOMPurify from 'dompurify';
import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData,
} from './api';
import { auth } from '../firebase';
import { TopicStructure, QuizItem } from '../types/content.types';
import { Question, QuizMetadata } from '../types/quiz.types';

// We explicitly type the cache dictionary
const topicStructureCache: Record<string, TopicStructure> = {};

// --- SECURITY: Configure DOMPurify ---
// We allow specific tags and attributes to ensure quiz formatting stays intact
// while stripping scripts, iframes (unless specifically allowed), and event handlers.
const sanitizeHtml = (dirty: string | undefined): string => {
    if (!dirty || typeof dirty !== 'string') return '';

    return DOMPurify.sanitize(dirty, {
        USE_PROFILES: { html: true }, // Only allow HTML, no SVG/MathML to reduce surface area
        ADD_TAGS: ['img', 'table', 'tbody', 'tr', 'td', 'th', 'mark'], // Ensure these key tags are kept
        ADD_ATTR: ['src', 'alt', 'class', 'style', 'data-content-key'], // Allow styling and your highlighter keys
    });
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

// --- REFACTORED getQuizData with SECURITY LAYER ---
export const getQuizData = async (topicId: string, sectionType: string, quizId: string, isPreviewMode: boolean = false): Promise<Question[]> => {
  // Determine if this is an unregistered preview request on the client-side
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

  // Clean the data, SANITIZE HTML, and cast to Question type
  return questionsArray.map((q: any) => {
      // 1. Sanitize the Question Text
      const sanitizedQuestionHtml = sanitizeHtml(q.question?.html_content);

      // 2. Sanitize Options
      const sanitizedOptions = Array.isArray(q.options) 
        ? q.options.map((opt: any) => ({
            ...opt,
            html_content: sanitizeHtml(opt.html_content)
        }))
        : [];

      // 3. Sanitize Explanation
      const sanitizedExplanationHtml = sanitizeHtml(q.explanation?.html_content);

      // 4. Sanitize Passage (if exists)
      let sanitizedPassage = undefined;
      if (q.passage && q.passage.html_content) {
          // We also remove the specific artifacts you were targeting with regex before
          let cleanHtml = sanitizeHtml(q.passage.html_content);
          
          // Remove legacy highlighter artifacts if they survived sanitization (class="highlighted")
          // Note: DOMPurify might strip classes depending on config, but this regex is a safe double-check
          cleanHtml = cleanHtml.replace(/<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
          
          sanitizedPassage = {
              ...q.passage,
              html_content: cleanHtml
          };
      }

      // Construct the safe Question object
      const question: Question = { 
          ...q,
          question: { ...q.question, html_content: sanitizedQuestionHtml },
          options: sanitizedOptions,
          explanation: { ...q.explanation, html_content: sanitizedExplanationHtml },
          passage: sanitizedPassage
      };
      
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
    fullNameForDisplay = `${mainTopicName} ${quizMeta.name}`;
    categoryForInstructions = mainTopicName;
  } else {
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