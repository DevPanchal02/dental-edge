// FILE: client/src/services/api.js

import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Stripe Checkout Function (UPDATED) ---
const functions = getFunctions();

// --- THIS IS THE FIX ---
// The default SDK might construct the wrong URL. We can explicitly provide the
// correct Cloud Run URL for our callable function to ensure it connects properly.
const createCheckoutSessionCallable = httpsCallable(
  functions,
  'createCheckoutSession',
  { uri: "https://createcheckoutsession-7ukimtpi4a-uc.a.run.app" }
);

export const createCheckoutSession = async () => {
  try {
    const result = await createCheckoutSessionCallable();
    return result.data.id;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    // This will now pass the more detailed error from the backend to the UI
    throw new Error(error.message || "Could not create a checkout session.");
  }
};
// --- END UPDATE ---

// --- Existing API Endpoints and Functions ---
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://gettopicstructure-7ukimtpi4a-uc.a.run.app",
  GET_QUIZ_DATA: "https://getquizdata-7ukimtpi4a-uc.a.run.app",
};

const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(true);
};

export const fetchTopics = async () => {
  try {
    const response = await fetch(API.GET_TOPICS);
    if (!response.ok) throw new Error(`API Error (getTopics): ${response.status} ${response.statusText}`);
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
        if (!response.ok) throw new Error(`API Error (getTopicStructure): ${response.status} ${response.statusText}`);
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
    if (isPreview) url.searchParams.append("isPreview", "true");

    const headers = {};
    if (!isPreview) {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication is required for this content.");
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
