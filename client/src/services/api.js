import { auth } from '../firebase';

// Centralized URLs for your cloud functions, based on your deployment logs.
// Using specific URLs is more robust than a single base URL, especially with mixed-generation functions.
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://us-central1-dental-edge.cloudfunctions.net/getTopicStructure",
  GET_QUIZ_DATA: "https://getquizdata-7ukimtpi4a-uc.a.run.app",
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
    // In a real app, you might redirect to a login page here.
    // For now, we'll throw an error to make it clear what's happening.
    throw new Error("Authentication Error: No user is signed in.");
  }
  // This will wait for the token to be ready, refreshing it if necessary.
  const forceRefresh = false; // Set to true if you ever suspect a stale token
  return await user.getIdToken(forceRefresh);
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
      throw new Error(`API Error (getTopics): ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    throw error; // Re-throw so the UI can handle it.
  }
};

/**
 * Fetches the detailed structure of a single topic, including its practice tests and question banks.
 * This is a public endpoint.
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
 * @param {string} storagePath - The full GCS path to the quiz JSON file.
 * @returns {Promise<Object>} A promise that resolves to the quiz data object.
 */
export const fetchQuizData = async (storagePath) => {
  try {
    // This function will be secured later in the project, but we build it correctly now.
    // const token = await getAuthToken(); // We'll uncomment this in the Authentication phase.

    const url = new URL(API.GET_QUIZ_DATA);
    url.searchParams.append("storagePath", storagePath);

    const response = await fetch(url.toString(), {
      headers: {
        // 'Authorization': `Bearer ${token}`, // We'll uncomment this later.
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (getQuizData): ${response.status} - ${errorText}`);
    }

    // The function returns the raw JSON file content, so we parse it here.
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch quiz data for path ${storagePath}:`, error);
    throw error;
  }
};