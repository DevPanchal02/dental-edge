// FILE: client/src/services/api.js

import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Configuration & Environment Setup ---

// Extract API URLs from environment variables using Vite's import.meta.env
const API_URLS = {
  GET_TOPICS: import.meta.env.VITE_FUNC_GET_TOPICS,
  GET_TOPIC_STRUCTURE: import.meta.env.VITE_FUNC_GET_TOPIC_STRUCTURE,
  GET_QUIZ_DATA: import.meta.env.VITE_FUNC_GET_QUIZ_DATA,
};

// Validation: Ensure environment variables are loaded correctly.
// This is critical for CI/CD pipelines where secrets might be missing.
Object.entries(API_URLS).forEach(([key, value]) => {
  if (!value) {
    console.error(`CRITICAL ERROR: Missing Environment Variable for ${key}. Check your .env file or CI/CD secrets.`);
  }
});

// --- Firebase Cloud Functions (Callable) Setup ---
// These functions are called using the Firebase SDK, which handles Auth tokens automatically.
const functions = getFunctions();

const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSession');
const saveInProgressAttemptCallable = httpsCallable(functions, 'saveInProgressAttempt');
const getInProgressAttemptCallable = httpsCallable(functions, 'getInProgressAttempt');
const finalizeQuizAttemptCallable = httpsCallable(functions, 'finalizeQuizAttempt');
const deleteInProgressAttemptCallable = httpsCallable(functions, 'deleteInProgressAttempt');
const getQuizAttemptByIdCallable = httpsCallable(functions, 'getQuizAttemptById');
const getCompletedAttemptsForQuizCallable = httpsCallable(functions, 'getCompletedAttemptsForQuiz');
const getQuizAnalyticsCallable = httpsCallable(functions, 'getQuizAnalytics');


// --- Callable Function Exports ---

/**
 * Creates a Stripe checkout session for a given subscription tier.
 * @param {string} tierId - The ID of the tier to purchase ('plus' or 'pro').
 * @returns {Promise<string>} The Stripe session ID.
 */
export const createCheckoutSession = async (tierId) => {
  try {
    const result = await createCheckoutSessionCallable({ tierId });
    return result.data.id;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw new Error(error.message || "Could not create a checkout session.");
  }
};

/**
 * Saves the current state of a quiz as 'in-progress'.
 * @param {object} attemptData - The current state of the quiz.
 * @returns {Promise<string>} The attemptId of the saved document.
 */
export const saveInProgressAttempt = async (attemptData) => {
  try {
    const result = await saveInProgressAttemptCallable(attemptData);
    return result.data.attemptId;
  } catch (error) {
    console.error("Error saving in-progress attempt:", error);
    // We don't throw here to avoid interrupting the user's quiz flow if auto-save fails
  }
};

/**
 * Retrieves an 'in-progress' quiz attempt for the current user and a specific quiz.
 * @param {object} quizIdentifiers - { topicId, sectionType, quizId }.
 * @returns {Promise<object|null>} The attempt data if found, otherwise null.
 */
export const getInProgressAttempt = async ({ topicId, sectionType, quizId }) => {
  try {
    const result = await getInProgressAttemptCallable({ topicId, sectionType, quizId });
    return result.data;
  } catch (error) {
    console.error("Error getting in-progress attempt:", error);
    throw new Error("Could not check for an existing quiz session.");
  }
};

/**
 * Finalizes and grades a quiz attempt.
 * @param {object} attemptData - The final state of the quiz to be submitted.
 * @returns {Promise<object>} An object containing the attemptId and the final score.
 */
export const finalizeQuizAttempt = async (attemptData) => {
  try {
    const result = await finalizeQuizAttemptCallable(attemptData);
    return result.data;
  } catch (error) {
    console.error("Error finalizing quiz attempt:", error);
    throw new Error("There was an error submitting your quiz. Please try again.");
  }
};

/**
 * Deletes an 'in-progress' quiz attempt.
 * @param {string} attemptId - The ID of the in-progress attempt document to delete.
 * @returns {Promise<void>}
 */
export const deleteInProgressAttempt = async (attemptId) => {
  try {
    await deleteInProgressAttemptCallable({ attemptId });
  } catch (error) {
    console.error("Error deleting in-progress attempt:", error);
  }
};

/**
 * Fetches a specific quiz attempt by its ID for review.
 * @param {string} attemptId - The document ID of the quiz attempt.
 * @returns {Promise<object>} The full quiz attempt data.
 */
export const getQuizAttemptById = async (attemptId) => {
  try {
    const result = await getQuizAttemptByIdCallable({ attemptId });
    return result.data;
  } catch (error) {
    console.error(`Error fetching attempt ${attemptId}:`, error);
    throw new Error("Could not load the specified quiz review.");
  }
};

/**
 * Fetches all completed attempts for a specific quiz.
 * @param {object} quizIdentifiers - { topicId, sectionType, quizId }.
 * @returns {Promise<Array>} A list of summarized completed attempts.
 */
export const getCompletedAttemptsForQuiz = async ({ topicId, sectionType, quizId }) => {
  try {
    const result = await getCompletedAttemptsForQuizCallable({ topicId, sectionType, quizId });
    return result.data;
  } catch (error) {
    console.error(`Error fetching completed attempts for ${quizId}:`, error);
    throw new Error("Could not load past results for this quiz.");
  }
};

/**
 * Fetches lightweight analytics data for a quiz.
 * @param {object} quizIdentifiers - { topicId, sectionType, quizId }.
 * @returns {Promise<Array>} An array of question analytics objects.
 */
export const getQuizAnalytics = async ({ topicId, sectionType, quizId }) => {
  try {
    const result = await getQuizAnalyticsCallable({ topicId, sectionType, quizId });
    return result.data;
  } catch (error) {
    console.error(`Error fetching analytics for ${quizId}:`, error);
    throw new Error("Could not load quiz analytics.");
  }
};


// --- HTTP Function Helpers ---

/**
 * Helper to get the current user's auth token for HTTP functions.
 * Returns null if no user is logged in.
 */
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return await user.getIdToken(true);
};


// --- HTTP Function Exports (Using Fetch API) ---

export const fetchTopics = async () => {
  try {
    // Using the Environment Variable URL
    const response = await fetch(API_URLS.GET_TOPICS);
    
    if (!response.ok) {
      throw new Error(`API Error (getTopics): ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    throw error;
  }
};

export const fetchTopicStructure = async (topicId) => {
  try {
    // Using the Environment Variable URL
    const url = new URL(API_URLS.GET_TOPIC_STRUCTURE);
    url.searchParams.append("topicId", topicId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API Error (getTopicStructure): ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch structure for topic ${topicId}:`, error);
    throw error;
  }
};

export const fetchQuizData = async (storagePath, isPreview = false) => {
  try {
    // Using the Environment Variable URL
    const url = new URL(API_URLS.GET_QUIZ_DATA);
    url.searchParams.append("storagePath", storagePath);
    
    if (isPreview) {
      url.searchParams.append("isPreview", "true");
    }

    const headers = {};
    if (!isPreview) {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication is required for this content.");
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 403) {
        // Attempt to parse specific error message from backend
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'upgrade_required') {
          const upgradeError = new Error("Upgrade required to access this content.");
          upgradeError.code = 'upgrade_required';
          throw upgradeError;
        }
      }
      throw new Error(`API Error (getQuizData): ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch quiz data for path ${storagePath}:`, error);
    throw error;
  }
};