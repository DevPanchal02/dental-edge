import { auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { QuizAttempt, Question } from '../types/quiz.types';
import { TopicSummary, TopicStructure } from '../types/content.types';

// --- Firebase Cloud Functions Setup ---
const functions = getFunctions();

// --- Types for Cloud Function Responses ---
interface CheckoutSessionResponse { id: string; }
interface SaveAttemptResponse { attemptId: string; }
interface FinalizeAttemptResponse { attemptId: string; score: number; }
interface EmptyResponse { success: boolean; }

// --- Callable Function Exports ---

export const createCheckoutSession = async (tierId: string): Promise<string> => {
  try {
    const callable = httpsCallable<{ tierId: string }, CheckoutSessionResponse>(functions, 'createCheckoutSession');
    const result = await callable({ tierId });
    return result.data.id;
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    throw new Error(error.message || "Could not create a checkout session.");
  }
};

export const saveInProgressAttempt = async (attemptData: Partial<QuizAttempt>): Promise<string | undefined> => {
  try {
    const callable = httpsCallable<Partial<QuizAttempt>, SaveAttemptResponse>(functions, 'saveInProgressAttempt');
    const result = await callable(attemptData);
    return result.data.attemptId;
  } catch (error) {
    console.error("Error saving in-progress attempt:", error);
    return undefined; 
  }
};

export const getInProgressAttempt = async (identifiers: { topicId: string; sectionType: string; quizId: string }): Promise<QuizAttempt | null> => {
  try {
    const callable = httpsCallable<typeof identifiers, QuizAttempt>(functions, 'getInProgressAttempt');
    const result = await callable(identifiers);
    return result.data;
  } catch (error) {
    console.error("Error getting in-progress attempt:", error);
    throw new Error("Could not check for an existing quiz session.");
  }
};

export const finalizeQuizAttempt = async (attemptData: QuizAttempt): Promise<FinalizeAttemptResponse> => {
  try {
    const callable = httpsCallable<QuizAttempt, FinalizeAttemptResponse>(functions, 'finalizeQuizAttempt');
    const result = await callable(attemptData);
    return result.data;
  } catch (error) {
    console.error("Error finalizing quiz attempt:", error);
    throw new Error("There was an error submitting your quiz. Please try again.");
  }
};

export const deleteInProgressAttempt = async (attemptId: string): Promise<void> => {
    try {
        const callable = httpsCallable<{ attemptId: string }, EmptyResponse>(functions, 'deleteInProgressAttempt');
        await callable({ attemptId });
    } catch (error) {
        console.error("Error deleting in-progress attempt:", error);
    }
};

export const getQuizAttemptById = async (attemptId: string): Promise<QuizAttempt> => {
    try {
        const callable = httpsCallable<{ attemptId: string }, QuizAttempt>(functions, 'getQuizAttemptById');
        const result = await callable({ attemptId });
        return result.data;
    } catch (error) {
        console.error(`Error fetching attempt ${attemptId}:`, error);
        throw new Error("Could not load the specified quiz review.");
    }
};

export const getCompletedAttemptsForQuiz = async (identifiers: { topicId: string; sectionType: string; quizId: string }): Promise<QuizAttempt[]> => {
    try {
        const callable = httpsCallable<typeof identifiers, QuizAttempt[]>(functions, 'getCompletedAttemptsForQuiz');
        const result = await callable(identifiers);
        return result.data;
    } catch (error) {
        console.error(`Error fetching completed attempts for ${identifiers.quizId}:`, error);
        throw new Error("Could not load past results for this quiz.");
    }
};

// STRICTLY TYPED ANALYTICS RESPONSE
export const getQuizAnalytics = async (identifiers: { topicId: string; sectionType: string; quizId: string }): Promise<Question[]> => {
    try {
        // The backend returns a lightweight Question object structure for analytics
        const callable = httpsCallable<typeof identifiers, Question[]>(functions, 'getQuizAnalytics');
        const result = await callable(identifiers);
        return result.data;
    } catch (error) {
        console.error(`Error fetching analytics for ${identifiers.quizId}:`, error);
        throw new Error("Could not load quiz analytics.");
    }
};


// --- HTTP Function Endpoints ---
const API = {
  GET_TOPICS: "/api/getTopics",
  GET_TOPIC_STRUCTURE: "/api/getTopicStructure",
  GET_QUIZ_DATA: "/api/getQuizData",
};

// Helper to get the current user's auth token for HTTP functions
const getAuthToken = async (): Promise<string | null> => {
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

export const fetchTopics = async (): Promise<TopicSummary[]> => {
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

export const fetchTopicStructure = async (topicId: string): Promise<TopicStructure> => {
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

/**
 * Fetches raw quiz data from the server.
 * Returns 'unknown' because validation happens in the loader layer (Zod).
 */
export const fetchQuizData = async (storagePath: string, isPreview: boolean = false): Promise<unknown> => {
  try {
    const url = new URL(API.GET_QUIZ_DATA, window.location.origin);
    url.searchParams.append("storagePath", storagePath);
    if (isPreview) {
      url.searchParams.append("isPreview", "true");
    }

    const headers: HeadersInit = {};
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
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        if (errorData.error === 'upgrade_required') {
          const upgradeError = new Error("Upgrade required to access this content.");
          (upgradeError as any).code = 'upgrade_required';
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