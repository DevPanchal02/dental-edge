// FILE: functions/src/services/quizService.js

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { formatId } = require("../utils/formatters");

const bucket = admin.storage().bucket();
const logger = require("firebase-functions/logger");

/**
 * Finds the full Google Cloud Storage path for a given quiz.
 * @param {string} topicId The ID of the topic (e.g., 'biology').
 * @param {string} quizId The ID of the quiz (e.g., 'test-1').
 * @returns {Promise<string|null>} The full storage path or null if not found.
 */
const findQuizStoragePath = async (topicId, quizId) => {
  if (!topicId || !quizId) return null;

  try {
    const [allFiles] = await bucket.getFiles({ prefix: `data/${topicId}/` });

    for (const file of allFiles) {
      const parts = file.name.split("/").filter(Boolean);
      if (parts.length < 4) continue;

      let currentFileQuizId = null;
      const fileName = parts[parts.length - 1];
      const sectionType = parts[2];

      if (sectionType === "practice-test") {
        const match = fileName.toLowerCase().match(/test_(\d+)/);
        if (match) {
          currentFileQuizId = `test-${match[1]}`;
        }
      } else if (sectionType === "question-bank") {
        // Safe usage of formatId, falling back if not available
        if (typeof formatId === 'function') {
            currentFileQuizId = formatId(fileName);
        } else {
            currentFileQuizId = fileName.replace(/\.json$/i, "").toLowerCase().replace(/\s+/g, "-");
        }
      }

      if (currentFileQuizId && currentFileQuizId === quizId) {
        return file.name;
      }
    }
  } catch (err) {
    logger.error("Error finding quiz storage path", err);
  }
  return null;
};

/**
 * Downloads and parses the full quiz data from storage.
 * @param {string} storagePath The full path to the quiz file in GCS.
 * @returns {Promise<Array<object>>} The array of question objects.
 */
const getFullQuizData = async (storagePath) => {
  try {
    const [quizDataBuffer] = await bucket.file(storagePath).download();
    const parsed = JSON.parse(quizDataBuffer.toString());
    
    // Normalize data: If it's wrapped in { questions: [] }, extract it.
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
        return parsed.questions;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error("Failed to download or parse quiz data", { storagePath, error: error.message });
    throw new HttpsError("internal", "Could not retrieve quiz data.");
  }
};

/**
 * Calculates a user's score based on their answers.
 * @param {object} userAnswers An object mapping question index to selected option label.
 * @param {Array<object>} allQuizQuestions The full array of quiz questions with correct answers.
 * @returns {number} The final score.
 */
const calculateScore = (userAnswers, allQuizQuestions) => {
  if (!userAnswers || !Array.isArray(allQuizQuestions)) return 0;
  
  let score = 0;
  allQuizQuestions.forEach((question, index) => {
    if (!question || !question.options || !Array.isArray(question.options)) return;

    const correctOption = question.options.find((opt) => opt.is_correct);
    if (correctOption && userAnswers[index] === correctOption.label) {
      score++;
    }
  });
  return score;
};

/**
 * Retrieves only the analytics portion of a quiz's data.
 * This is more efficient than sending the entire quiz file to the client.
 * @param {string} storagePath The full path to the quiz file in GCS.
 * @returns {Promise<Array<object>>} An array of lightweight question analytics objects.
 */
const getQuizAnalytics = async (storagePath) => {
  try {
    const fullQuizData = await getFullQuizData(storagePath);
    
    if (!Array.isArray(fullQuizData)) return [];

    return fullQuizData.map((q) => {
      if (!q) return { analytics: {}, category: "Unknown", options: [] };
      
      return {
        analytics: q.analytics || {},
        category: q.category || "General",
        options: Array.isArray(q.options) 
          ? q.options.map((opt) => ({
              label: opt.label || "?",
              is_correct: !!opt.is_correct,
            })) 
          : []
      };
    });
  } catch (error) {
    logger.error(`Error generating analytics for ${storagePath}:`, error);
    return [];
  }
};

module.exports = {
  findQuizStoragePath,
  getFullQuizData,
  calculateScore,
  getQuizAnalytics,
};