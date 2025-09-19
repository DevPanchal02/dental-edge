// FILE: client/src/services/api.js

import { auth } from '../firebase';

// The base URL for your Cloud Functions.
// THIS SECTION IS NO LONGER USED, AS EACH FUNCTION HAS A UNIQUE URL.
// const CLOUD_FUNCTIONS_BASE_URL = "https://us-central1-dental-edge-62624.cloudfunctions.net";

// --- THIS IS THE FIX ---
// Use the exact URLs provided in your successful deployment log.
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://gettopicstructure-7ukimtpi4a-uc.a.run.app",
  GET_QUIZ_DATA: "https://getquizdata-7ukimtpi4a-uc.a.run.app",
};

// Helper to get the current user's auth token.
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  // Force refresh the token if it's about to expire.
  return await user.getIdToken(true);
};

// --- Public Data Fetchers (No change in logic) ---
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

// --- NEW UNIFIED QUIZ DATA FETCHER ---
export const fetchQuizData = async (storagePath, isPreview = false) => {
  try {
    const url = new URL(API.GET_QUIZ_DATA);
    url.searchParams.append("storagePath", storagePath);
    if (isPreview) {
      url.searchParams.append("isPreview", "true");
    }

    const headers = {};
    // Only add the Authorization header if the user is logged in (i.e., not a preview)
    if (!isPreview) {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication is required for this content.");
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      // Handle specific error codes from the backend
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'upgrade_required') {
          const upgradeError = new Error("Upgrade required to access this content.");
          upgradeError.code = 'upgrade_required'; // Keep this code for the frontend to act on
          throw upgradeError;
        }
      }
      // Throw a generic error for other issues
      throw new Error(`API Error (getQuizData): ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Log and re-throw the error to be handled by the calling component (e.g., QuizPage)
    console.error(`Failed to fetch quiz data for path ${storagePath}:`, error);
    throw error;
  }
};