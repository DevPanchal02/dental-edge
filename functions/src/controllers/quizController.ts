import { CallableRequest, HttpsError, Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import * as quizService from '../services/quizService';
import * as userService from '../services/userService';
import { 
    QuizIdentifiersSchema, 
    QuizAttemptSchema, 
    QuizIdentifiers, 
    QuizAttempt 
} from '../schemas/quiz.schemas';

// --- HTTP Request Handler (for fetching raw quiz data) ---
export const getQuizData = async (request: Request, response: Response): Promise<void> => {
  // 1. Extract and Validate Query Params manually (since it's HTTP, not Callable)
  const storagePath = request.query.storagePath as string;
  const isPreview = request.query.isPreview === "true";

  if (!storagePath) {
    response.status(400).send("Bad Request: Missing storagePath parameter.");
    return;
  }

  // 2. Handle Unregistered Preview
  if (isPreview) {
    logger.info("Unregistered preview request received.", { storagePath });
    try {
      const fullData = await quizService.getFullQuizData(storagePath);
      // Only return first 2 questions for preview
      response.status(200).json(fullData.slice(0, 2));
    } catch (e: any) {
      logger.error("Error serving quiz preview", { error: e.message, storagePath });
      response.status(500).send("Internal Server Error");
    }
    return;
  }

  // 3. Validate Auth Token
  const authHeader = request.headers.authorization;
  const idToken = authHeader?.split("Bearer ")[1];
  
  if (!idToken) {
    response.status(401).send("Unauthorized: Missing auth token.");
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 4. Check User Tier (Access Control)
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
      response.status(403).json({ 
        error: "upgrade_required", 
        message: "A higher tier is required to access this content." 
      });
      return;
    }

    // 5. Return Data
    const data = await quizService.getFullQuizData(storagePath);
    response.status(200).json(data);

  } catch (error: any) {
    if (error.code === "auth/id-token-expired") {
      response.status(403).send("Forbidden: Auth token has expired.");
      return;
    }
    logger.error("Error in getQuizData controller", { error: error.message });
    response.status(500).send("Internal Server Error");
  }
};

// --- Callable: Save In-Progress ---
// We use 'any' for the generic here because we manually validate with Zod inside
export const saveInProgressAttempt = async (request: CallableRequest<any>): Promise<{ attemptId: string }> => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save progress.");
  }
  
  // Zod Validation: Ensure input matches the Partial<QuizAttempt> shape
  // Note: We use .partial() because we might be saving an incomplete attempt
  const validation = QuizAttemptSchema.partial().safeParse(request.data);
  
  if (!validation.success) {
      logger.error("Validation failed for saveInProgressAttempt", validation.error);
      throw new HttpsError("invalid-argument", "Invalid attempt data format.");
  }
  
  const attemptData = validation.data as Partial<QuizAttempt>;
  const { uid } = request.auth;

  // Delegate to service
  const attemptId = await userService.saveAttempt(uid, {
    ...attemptData, 
    status: "in-progress" // Force status on backend
  });
  
  return { attemptId };
};

// --- Callable: Get In-Progress ---
export const getInProgressAttempt = async (request: CallableRequest<any>): Promise<QuizAttempt | null> => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const validation = QuizIdentifiersSchema.safeParse(request.data);
  if (!validation.success) {
      throw new HttpsError("invalid-argument", "Missing or invalid quiz identifiers.");
  }

  return await userService.findInProgressAttempt(request.auth.uid, validation.data);
};

// --- Callable: Get Specific Attempt (Review Mode) ---
export const getQuizAttemptById = async (request: CallableRequest<{ attemptId: string }>): Promise<QuizAttempt> => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { attemptId } = request.data;
  if (!attemptId) throw new HttpsError("invalid-argument", "Missing attemptId.");

  return await userService.findAttemptById(request.auth.uid, attemptId);
};

// --- Callable: Delete In-Progress ---
export const deleteInProgressAttempt = async (request: CallableRequest<{ attemptId: string }>): Promise<{ success: boolean }> => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const { attemptId } = request.data;
  if (!attemptId) throw new HttpsError("invalid-argument", "Missing attemptId.");

  await userService.deleteAttempt(request.auth.uid, attemptId);
  return { success: true };
};

// --- Callable: Finalize (Submit) ---
export const finalizeQuizAttempt = async (request: CallableRequest<any>): Promise<{ attemptId: string; score: number }> => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  // Validate full attempt structure
  const validation = QuizAttemptSchema.safeParse(request.data);
  if (!validation.success) {
      logger.error("Finalize attempt validation failed", validation.error);
      throw new HttpsError("invalid-argument", "Invalid quiz submission data.");
  }

  const attemptState = validation.data;
  const { uid } = request.auth;
  
  if (!attemptState.id) throw new HttpsError("invalid-argument", "Missing attempt ID.");

  // 1. Find the file path
  const storagePath = await quizService.findQuizStoragePath(attemptState.topicId, attemptState.quizId);
  if (!storagePath) {
    throw new HttpsError("not-found", `Could not find quiz data file for ${attemptState.quizId}.`);
  }

  // 2. Get questions and calculate score
  const allQuestions = await quizService.getFullQuizData(storagePath);
  const score = quizService.calculateScore(attemptState.userAnswers, allQuestions);

  // 3. Save result
  await userService.finalizeAttempt(uid, attemptState.id, attemptState, score, allQuestions.length);

  return { attemptId: attemptState.id, score };
};

// --- Callable: Analytics ---
export const getQuizAnalytics = async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  // We only need topicId and quizId
  const { topicId, quizId } = request.data;
  if(!topicId || !quizId) throw new HttpsError("invalid-argument", "Missing identifiers.");

  const storagePath = await quizService.findQuizStoragePath(topicId, quizId);
  if (!storagePath) throw new HttpsError("not-found", "Quiz file not found.");

  return await quizService.getQuizAnalytics(storagePath);
};

// --- Callable: Get Completed History ---
export const getCompletedAttempts = async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  
  const validation = QuizIdentifiersSchema.safeParse(request.data);
  if (!validation.success) throw new HttpsError("invalid-argument", "Invalid identifiers.");

  return await userService.getCompletedAttempts(request.auth.uid, validation.data);
};