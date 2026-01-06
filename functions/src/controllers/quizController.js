// FILE: functions/src/controllers/quizController.js

const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const quizService = require("../services/quizService");
const userService = require("../services/userService");

// --- HTTP Request Handler (for fetching raw quiz data) ---
const getQuizData = async (request, response) => {
  const { storagePath, isPreview } = request.query;

  if (!storagePath) {
    return response.status(400).send("Bad Request: Missing storagePath parameter.");
  }

  // 1. Handle Unregistered Preview
  if (isPreview === "true") {
    logger.info("Unregistered preview request received.", { storagePath });
    try {
      const fullData = await quizService.getFullQuizData(storagePath);
      // Only return first 2 questions for preview
      response.status(200).json(fullData.slice(0, 2));
    } catch (e) {
      logger.error("Error serving quiz preview", { error: e.message, storagePath });
      response.status(500).send("Internal Server Error");
    }
    return;
  }

  // 2. Validate Auth Token
  const idToken = request.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return response.status(401).send("Unauthorized: Missing auth token.");
  }

  try {
    const admin = require("firebase-admin");
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 3. Check User Tier (Access Control)
    const userTier = await userService.getUserTier(uid);
    
    // Logic: Free content usually has "Test_1" or "1_" in the filename
    const isFreeContent = storagePath.includes("Test_1_Data.json") || 
                          storagePath.includes("1_") || 
                          storagePath.endsWith("_1.json");

    let hasAccess = false;
    if (isFreeContent || userTier === "plus" || userTier === "pro") {
      hasAccess = true;
    }

    logger.info({ 
      message: "Content Access Request", 
      uid, 
      userTier, 
      storagePath, 
      accessDecision: hasAccess ? "granted" : "denied" 
    });

    if (!hasAccess) {
      return response.status(403).json({ 
        error: "upgrade_required", 
        message: "A higher tier is required to access this content." 
      });
    }

    // 4. Return Data
    const data = await quizService.getFullQuizData(storagePath);
    response.status(200).json(data);

  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return response.status(403).send("Forbidden: Auth token has expired.");
    }
    logger.error("Error in getQuizData controller", { error: error.message });
    return response.status(500).send("Internal Server Error");
  }
};

// --- Callable: Save In-Progress ---
const saveInProgressAttempt = async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save progress.");
  }
  const { uid } = request.auth;
  const { topicId, sectionType, quizId, ...attemptState } = request.data;
  
  // Delegate to service
  const attemptId = await userService.saveAttempt(uid, {
    topicId, sectionType, quizId, ...attemptState, status: "in-progress"
  });
  
  return { attemptId };
};

// --- Callable: Get In-Progress ---
const getInProgressAttempt = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { uid } = request.auth;
  return await userService.findInProgressAttempt(uid, request.data);
};

// --- Callable: Delete In-Progress ---
const deleteInProgressAttempt = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { attemptId } = request.data;
  if (!attemptId) throw new HttpsError("invalid-argument", "Missing attemptId.");

  await userService.deleteAttempt(request.auth.uid, attemptId);
  return { success: true };
};

// --- Callable: Finalize (Submit) ---
const finalizeQuizAttempt = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { uid } = request.auth;
  const { topicId, sectionType, quizId, ...attemptState } = request.data;
  
  if (!attemptState.id) throw new HttpsError("invalid-argument", "Missing attempt ID.");

  // 1. Find the file path
  const storagePath = await quizService.findQuizStoragePath(topicId, quizId);
  if (!storagePath) {
    throw new HttpsError("not-found", `Could not find quiz data file for ${quizId}.`);
  }

  // 2. Get questions and calculate score
  const allQuestions = await quizService.getFullQuizData(storagePath);
  const score = quizService.calculateScore(attemptState.userAnswers, allQuestions);

  // 3. Save result
  await userService.finalizeAttempt(uid, attemptState.id, attemptState, score, allQuestions.length);

  return { attemptId: attemptState.id, score };
};

// --- Callable: Analytics ---
const getQuizAnalytics = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const { topicId, quizId } = request.data;

  const storagePath = await quizService.findQuizStoragePath(topicId, quizId);
  if (!storagePath) throw new HttpsError("not-found", "Quiz file not found.");

  return await quizService.getQuizAnalytics(storagePath);
};

// --- Callable: Get Specific Attempt (Review Mode) ---
const getQuizAttemptById = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { attemptId } = request.data;
  if (!attemptId) throw new HttpsError("invalid-argument", "Missing attemptId.");

  // Delegate to userService to fetch the single document
  return await userService.findAttemptById(request.auth.uid, attemptId);
};

// --- Callable: Get Completed History ---
const getCompletedAttempts = async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  return await userService.getCompletedAttempts(request.auth.uid, request.data);
};

module.exports = {
  getQuizData,
  saveInProgressAttempt,
  getInProgressAttempt,
  getQuizAttemptById,
  deleteInProgressAttempt,
  finalizeQuizAttempt,
  getQuizAnalytics,
  getCompletedAttempts
};
