// FILE: client/src/services/api.js

import { auth } from '../firebase';

// Centralized URLs for your cloud functions, based on your deployment logs.
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://gettopicstructure-7ukimtpi4a-uc.a.run.app", // Corrected this function's name
  GET_QUIZ_DATA: "https://getquizdata-7ukimtpi4a-uc.a.run.app",
};

/**
 * A helper function to get the current user's authentication token.
 * This is a critical step for making secure, authenticated API calls.
 * @returns {Promise<string|null>} The user's ID token or null if not signed in.
 */
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return await user.getIdToken();
};

/**
 * Fetches the list of available topics from the backend.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of topic objects.
 */
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

// --- THIS IS THE MISSING FUNCTION ---
/**
 * Fetches the detailed structure of a single topic, including its practice tests and question banks.
 * @param {string} topicId - The ID of the topic (e.g., 'biology').
 * @returns {Promise<Object>} A promise that resolves to the topic structure object.
 */
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


/**
 * Fetches the complete data for a specific quiz from the secure backend.
 * This function handles getting the auth token and making the authenticated request.
 * @param {string} topicId - The ID of the topic (e.g., 'biology').
 * @param {string} sectionType - 'practice' or 'qbank'.
 * @param {string} quizId - The ID of the quiz (e.g., 'test-1').
 * @returns {Promise<Object>} A promise that resolves to the quiz data object.
 */
export const fetchQuizData = async (topicId, sectionType, quizId) => {
  try {
    const token = await getAuthToken(); // Will be null if user is not logged in

    const url = new URL(API.GET_QUIZ_DATA);
    url.searchParams.append("topicId", topicId);
    url.searchParams.append("sectionType", sectionType);
    url.searchParams.append("quizId", quizId);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `API Error: ${response.status}` }));
      throw new Error(errorData.message || `An unknown error occurred.`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch quiz data for ${topicId}/${quizId}:`, error);
    throw error;
  }
};