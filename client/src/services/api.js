// FILE: client/src/services/api.js

import { auth } from '../firebase';

// NOTE: Please double-check that these URLs match YOUR deployment log.
const API = {
  GET_TOPICS: "https://gettopics-7ukimtpi4a-uc.a.run.app",
  GET_TOPIC_STRUCTURE: "https://gettopicstructure-7ukimtpi4a-uc.a.run.app",
  GET_QUIZ_PREVIEW: "https://getquizpreview-7ukimtpi4a-uc.a.run.app",
  GET_FREE_CONTENT: "https://getfreecontent-7ukimtpi4a-uc.a.run.app",
  GET_PAID_CONTENT: "https://getpaidcontent-7ukimtpi4a-uc.a.run.app",
};

const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return await user.getIdToken();
};

// --- THIS IS THE FIX: RESTORING FULL IMPLEMENTATIONS ---
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
// --- END FIX ---


export const fetchQuizPreview = async () => {
    try {
        const response = await fetch(API.GET_QUIZ_PREVIEW);
        if (!response.ok) {
            throw new Error(`API Error (getQuizPreview): ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch quiz preview:", error);
        throw error;
    }
};

export const fetchFreeContent = async (storagePath) => {
    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication is required for free content.");
        }
        const url = new URL(API.GET_FREE_CONTENT);
        url.searchParams.append("storagePath", storagePath);

        const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error(`API Error (getFreeContent): ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch free content for path ${storagePath}:`, error);
        throw error;
    }
};

export const fetchPaidContent = async (storagePath) => {
    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication is required for paid content.");
        }
        const url = new URL(API.GET_PAID_CONTENT);
        url.searchParams.append("storagePath", storagePath);

        const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error === 'upgrade_required') {
                const upgradeError = new Error("Upgrade required to access this content.");
                upgradeError.code = 'upgrade_required';
                throw upgradeError;
            }
            throw new Error(`API Error (getPaidContent): ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch paid content for path ${storagePath}:`, error);
        throw error;
    }
};