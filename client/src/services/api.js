// FILE: client/src/services/api.js

import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Firebase Cloud Functions Setup ---
const functions = getFunctions();

// Callable function for creating Stripe checkout sessions
const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSession');

// --- NEW: Callable functions for quiz attempt management ---
const saveInProgressAttemptCallable = httpsCallable(functions, 'saveInProgressAttempt');
const getInProgressAttemptCallable = httpsCallable(functions, 'getInProgressAttempt');
const finalizeQuizAttemptCallable = httpsCallable(functions, 'finalizeQuizAttempt');
const deleteInProgressAttemptCallable = httpsCallable(functions, 'deleteInProgressAttempt'); // This was here
const getQuizAttemptByIdCallable = httpsCallable(functions, 'getQuizAttemptById');
const getCompletedAttemptsForQuizCallable = httpsCallable(functions, 'getCompletedAttemptsForQuiz');


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

// --- NEW: Quiz Attempt API Functions ---

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
    // Don't throw an error for background saves, just log it.
    // Throwing could interrupt the user's flow.
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
    return result.data; // Will be null if not found, or the attempt object
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
    return result.data; // { attemptId, score }
  } catch (error) {
    console.error("Error finalizing quiz attempt:", error);
    throw new Error("There was an error submitting your quiz. Please try again.");
  }
};

/**
 * --- FIX: This is the missing function that caused the error. ---
 * Deletes an 'in-progress' quiz attempt.
 * @param {string} attemptId - The ID of the in-progress attempt document to delete.
 * @returns {Promise<void>}
 */
export const deleteInProgressAttempt = async (attemptId) => {
    try {
        // The payload to the cloud function should be an object.
        await deleteInProgressAttemptCallable({ attemptId });
    } catch (error) {
        console.error("Error deleting in-progress attempt:", error);
        // We don't throw here as it's not a critical failure for the user experience.
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


// --- HTTP Function Endpoints ---
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://gettopicstructure-7ukimtpi4a-uc.a.run.app",
  GET_QUIZ_DATA: "https://getquizdata-7ukimtpi4a-uc.a.run.app",
};

// Helper to get the current user's auth token for HTTP functions
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return await user.getIdToken(true);
};

// --- HTTP Function Exports ---

export const fetchTopics = async () => {
  try {
    const response = await fetch(API.GET_TOPICS);
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
        const url = new URL(API.GET_TOPIC_STRUCTURE);
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
    const url = new URL(API.GET_QUIZ_DATA);
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