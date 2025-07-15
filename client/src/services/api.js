import { auth } from '../firebase';

// Centralized base URLs for your cloud functions.
// Storing them here means if you ever change regions, you only update them in one place.
const BASE_URL = "https://us-central1-dental-edge.cloudfunctions.net";
const API = {
  GET_TOPICS: `${BASE_URL}/getTopics`,
  GET_QUIZ_DATA: `${BASE_URL}/getQuizData`,
};

/**
 * A helper function to get the current user's authentication token.
 * This is a critical step for making secure, authenticated API calls.
 * @returns {Promise<string>} The user's ID token.
 * @throws Will throw an error if no user is signed in.
 */
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication Error: No user is signed in.");
  }
  return await user.getIdToken();
};

/**
 * Fetches the list of available topics from the backend.
 * This is a public endpoint and does not require authentication.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of topic objects.
 */
export const fetchTopics = async () => {
  try {
    const response = await fetch(API.GET_TOPICS);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    // Re-throw the error so the calling component can handle it (e.g., show an error message).
    throw error;
  }
};

/**
 * Fetches the complete data for a specific quiz from the secure backend.
 * This function handles getting the auth token and making the authenticated request.
 * @param {string} topicId - The ID of the topic.
 * @param {string} sectionType - The type of section ('practice-test' or 'qbank').
 * @param {string} quizId - The ID of the specific quiz.
 * @returns {Promise<Object>} A promise that resolves to the quiz data object.
 */
export const fetchQuizData = async (topicId, sectionType, quizId) => {
  try {
    const token = await getAuthToken();
    
    const url = new URL(API.GET_QUIZ_DATA);
    url.searchParams.append("topicId", topicId);
    url.searchParams.append("sectionType", sectionType);
    url.searchParams.append("quizId", quizId);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch quiz data for ${quizId}:`, error);
    throw error;
  }
};