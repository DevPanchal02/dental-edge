// FILE: client/src/services/api.js

import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Firebase Cloud Functions Setup ---
const functions = getFunctions();

// Callable function for creating Stripe checkout sessions
const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSession');

// --- Callable Function Exports ---

// This function now accepts a tierId to create dynamic checkout sessions.
export const createCheckoutSession = async (tierId) => {
  try {
    // Pass the tierId in the data payload to the backend function
    const result = await createCheckoutSessionCallable({ tierId });
    return result.data.id; // Returns the session ID from the backend
  } catch (error) {
    console.error("Error creating checkout session:", error);
    // Pass a more useful error message up to the UI component
    throw new Error(error.message || "Could not create a checkout session.");
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
  // Force refresh the token if it's about to expire to prevent auth errors.
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
