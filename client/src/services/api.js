import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Firebase Cloud Functions Setup ---
const functions = getFunctions();

// These use the Firebase SDK (httpsCallable), so they automatically find the correct URL.
const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSession');
const saveInProgressAttemptCallable = httpsCallable(functions, 'saveInProgressAttempt');
const getInProgressAttemptCallable = httpsCallable(functions, 'getInProgressAttempt');
const finalizeQuizAttemptCallable = httpsCallable(functions, 'finalizeQuizAttempt');
const deleteInProgressAttemptCallable = httpsCallable(functions, 'deleteInProgressAttempt');
const getQuizAttemptByIdCallable = httpsCallable(functions, 'getQuizAttemptById');
const getCompletedAttemptsForQuizCallable = httpsCallable(functions, 'getCompletedAttemptsForQuiz');
const getQuizAnalyticsCallable = httpsCallable(functions, 'getQuizAnalytics');


// --- Callable Function Exports ---

export const createCheckoutSession = async (tierId) => {
  try {
    const result = await createCheckoutSessionCallable({ tierId });
    return result.data.id;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw new Error(error.message || "Could not create a checkout session.");
  }
};

export const saveInProgressAttempt = async (attemptData) => {
  try {
    const result = await saveInProgressAttemptCallable(attemptData);
    return result.data.attemptId;
  } catch (error) {
    console.error("Error saving in-progress attempt:", error);
  }
};

export const getInProgressAttempt = async ({ topicId, sectionType, quizId }) => {
  try {
    const result = await getInProgressAttemptCallable({ topicId, sectionType, quizId });
    return result.data;
  } catch (error) {
    console.error("Error getting in-progress attempt:", error);
    throw new Error("Could not check for an existing quiz session.");
  }
};

export const finalizeQuizAttempt = async (attemptData) => {
  try {
    const result = await finalizeQuizAttemptCallable(attemptData);
    return result.data;
  } catch (error) {
    console.error("Error finalizing quiz attempt:", error);
    throw new Error("There was an error submitting your quiz. Please try again.");
  }
};

export const deleteInProgressAttempt = async (attemptId) => {
    try {
        await deleteInProgressAttemptCallable({ attemptId });
    } catch (error) {
        console.error("Error deleting in-progress attempt:", error);
    }
};

export const getQuizAttemptById = async (attemptId) => {
    try {
        const result = await getQuizAttemptByIdCallable({ attemptId });
        return result.data;
    } catch (error) {
        console.error(`Error fetching attempt ${attemptId}:`, error);
        throw new Error("Could not load the specified quiz review.");
    }
};

export const getCompletedAttemptsForQuiz = async ({ topicId, sectionType, quizId }) => {
    try {
        const result = await getCompletedAttemptsForQuizCallable({ topicId, sectionType, quizId });
        return result.data;
    } catch (error) {
        console.error(`Error fetching completed attempts for ${quizId}:`, error);
        throw new Error("Could not load past results for this quiz.");
    }
};

export const getQuizAnalytics = async ({ topicId, sectionType, quizId }) => {
    try {
        const result = await getQuizAnalyticsCallable({ topicId, sectionType, quizId });
        return result.data;
    } catch (error) {
        console.error(`Error fetching analytics for ${quizId}:`, error);
        throw new Error("Could not load quiz analytics.");
    }
};


// --- HTTP Function Endpoints (Refactored to Relative Paths) ---
const API = {
  GET_TOPICS: "/api/getTopics",
  GET_TOPIC_STRUCTURE: "/api/getTopicStructure",
  GET_QUIZ_DATA: "/api/getQuizData",
};

// Helper to get the current user's auth token for HTTP functions
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  try {
    return await user.getIdToken(true);
  } catch (error) {
    console.error("Auth Token Error:", error);
    throw new Error("Connection blocked. Please check your internet or disable AdBlockers.");
  }
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
        const url = new URL(API.GET_TOPIC_STRUCTURE, window.location.origin);
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
    const url = new URL(API.GET_QUIZ_DATA, window.location.origin);
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