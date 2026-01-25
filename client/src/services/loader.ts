import DOMPurify from 'dompurify';
import { z } from 'zod';
import {
  fetchTopics as apiFetchTopics,
  fetchTopicStructure,
  fetchQuizData,
} from './api';
import { auth } from '../firebase';
import { TopicStructure, QuizItem } from '../types/content.types';
import { Question, QuizMetadata } from '../types/quiz.types';
import { QuestionSchema } from '../schemas/quiz.schemas';

// --- Cache Definitions ---
const topicStructureCache: Record<string, TopicStructure> = {};

// --- Types for Incoming JSON Data ---
// These interfaces describe the "loose" shape of data before it is sanitized and validated.
// We use 'unknown' for fields to force strict checks before access.
interface IncomingOption {
    label?: unknown;
    html_content?: unknown;
    is_correct?: unknown;
    percentage_selected?: unknown;
}

interface IncomingPassage {
    html_content?: unknown;
    id?: unknown;
}

interface IncomingExplanation {
    html_content?: unknown;
}

interface IncomingQuestionItem {
    id?: unknown;
    question?: { html_content?: unknown };
    options?: unknown; // Needs to be checked if array
    explanation?: IncomingExplanation;
    passage?: IncomingPassage;
    analytics?: unknown;
    category?: unknown;
    correct_answer_original_text?: unknown;
    error?: unknown;
}

// --- SECURITY: Configure DOMPurify ---
const sanitizeHtml = (dirty: unknown): string => {
    if (!dirty || typeof dirty !== 'string') return '';

    return DOMPurify.sanitize(dirty, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['img', 'table', 'tbody', 'tr', 'td', 'th', 'mark'],
        ADD_ATTR: ['src', 'alt', 'class', 'style', 'data-content-key'],
    });
};

// Re-export fetchTopics
export const fetchTopics = apiFetchTopics;

/**
 * Fetches and caches the hierarchical structure of a topic.
 */
export const fetchTopicData = async (topicId: string): Promise<TopicStructure> => {
  if (topicStructureCache[topicId]) {
    return topicStructureCache[topicId];
  }
  const structure = await fetchTopicStructure(topicId);
  topicStructureCache[topicId] = structure;
  return structure;
};

/**
 * Helper to traverse the TopicStructure and find a specific quiz.
 */
const findQuizInStructure = (topicData: TopicStructure | null, sectionType: string, quizId: string): QuizItem | null => {
  if (!topicData) return null;
  
  if (sectionType === 'practice') {
    return topicData.practiceTests.find(pt => pt.id === quizId) || null;
  }
  
  if (sectionType === 'qbank') {
    for (const categoryGroup of topicData.questionBanks) {
      const bank = categoryGroup.banks.find(b => b.id === quizId);
      if (bank) {
        return { ...bank, qbCategory: categoryGroup.category };
      }
    }
  }
  return null;
};

/**
 * Main Data Loader
 * strictly typed to avoid 'any' leakage.
 */
export const getQuizData = async (topicId: string, sectionType: string, quizId: string, isPreviewMode: boolean = false): Promise<Question[]> => {
  // Determine if this is an unregistered preview request
  const isPreview = isPreviewMode || (!auth.currentUser && topicId === 'biology' && sectionType === 'practice' && quizId === 'test-1');

  const topicData = await fetchTopicData(topicId);
  const quizMeta = findQuizInStructure(topicData, sectionType, quizId);

  if (!quizMeta || !quizMeta.storagePath) {
    throw new Error(`Quiz data could not be located for ${topicId}/${quizId}`);
  }

  // Fetch raw data (unknown shape)
  const rawData = await fetchQuizData(quizMeta.storagePath, isPreview);

  // Normalize data: Ensure we have an array
  let questionsArray: unknown[] = [];
  
  if (Array.isArray(rawData)) {
      questionsArray = rawData;
  } else if (rawData && typeof rawData === 'object' && 'questions' in rawData) {
      // Safe cast because we checked 'questions' in rawData
      const wrapper = rawData as { questions: unknown };
      if (Array.isArray(wrapper.questions)) {
          questionsArray = wrapper.questions;
      }
  }

  // Transformation & Sanitization Phase
  const sanitizedQuestions = questionsArray.map((item: unknown) => {
      // Type Guard: Ensure item is an object
      if (!item || typeof item !== 'object') {
          return {}; // Zod will catch this as invalid later
      }

      // Cast to our loose Incoming interface to allow safe property access
      const q = item as IncomingQuestionItem;

      // 1. Sanitize Question Text
      const sanitizedQuestionHtml = sanitizeHtml(q.question?.html_content);

      // 2. Sanitize Options
      // We strictly check if options is an array before mapping
      let sanitizedOptions: unknown[] = [];
      
      if (Array.isArray(q.options)) {
          sanitizedOptions = q.options.map((opt: unknown) => {
              if (!opt || typeof opt !== 'object') return {};
              const incomingOpt = opt as IncomingOption;
              return {
                  ...incomingOpt,
                  html_content: sanitizeHtml(incomingOpt.html_content)
              };
          });
      }

      // 3. Sanitize Explanation
      const sanitizedExplanationHtml = sanitizeHtml(q.explanation?.html_content);

      // 4. Sanitize Passage (if exists)
      let sanitizedPassage = undefined;
      if (q.passage && typeof q.passage === 'object') {
          const rawHtml = q.passage.html_content;
          if (rawHtml) {
              let cleanHtml = sanitizeHtml(rawHtml);
              // Remove legacy highlighter artifacts
              cleanHtml = cleanHtml.replace(/<mark\s+[^>]*class="[^"]*highlighted[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
              
              sanitizedPassage = {
                  ...q.passage,
                  html_content: cleanHtml
              };
          }
      }

      // Construct object for Zod validation
      // We preserve properties like 'analytics' and 'category' if they exist
      return { 
          ...q,
          question: { ...q.question, html_content: sanitizedQuestionHtml },
          options: sanitizedOptions,
          explanation: { ...q.explanation, html_content: sanitizedExplanationHtml },
          passage: sanitizedPassage
      };
  });

  // Validation Phase
  // Zod parses the sanitized structure. If any required fields are missing 
  // (e.g. if we returned {} above), Zod throws a detailed error.
  return z.array(QuestionSchema).parse(sanitizedQuestions);
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