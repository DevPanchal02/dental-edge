import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { UserTier } from '../types/models.types';
import { QuizAttempt } from '../schemas/quiz.schemas';

/**
 * Retrieves the user's subscription tier from their Firestore document.
 */
export const getUserTier = async (uid: string): Promise<UserTier> => {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        logger.warn("User document not found for authenticated user.", { uid });
        return "free";
    }
    const data = userDoc.data();
    return (data?.tier as UserTier) || "free";
};

/**
 * Saves or creates an in-progress quiz attempt for a user.
 * We use Partial<QuizAttempt> because the client might send updates (patches).
 */
export const saveAttempt = async (uid: string, attemptData: Partial<QuizAttempt>): Promise<string> => {
    const collectionRef = db.collection("users").doc(uid).collection("quizAttempts");
    const { id, ...dataToSave } = attemptData;

    // Add server timestamp
    const payload = {
        ...dataToSave,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (id) {
        logger.info(`Updating in-progress attempt: ${id} for user: ${uid}`);
        await collectionRef.doc(id).set(payload, { merge: true });
        return id;
    } else {
        logger.info(`Creating new in-progress attempt for user: ${uid}`);
        // For new documents, add createdAt
        const newDocPayload = {
            ...payload,
            createdAt: FieldValue.serverTimestamp(),
        };
        const newDocRef = await collectionRef.add(newDocPayload);
        return newDocRef.id;
    }
};

/**
 * Finds a user's most recent in-progress attempt for a specific quiz.
 */
export const findInProgressAttempt = async (uid: string, identifiers: { topicId: string; sectionType: string; quizId: string }): Promise<QuizAttempt | null> => {
    const { topicId, sectionType, quizId } = identifiers;
    
    const querySnapshot = await db.collection("users").doc(uid).collection("quizAttempts")
        .where("topicId", "==", topicId)
        .where("sectionType", "==", sectionType)
        .where("quizId", "==", quizId)
        .where("status", "==", "in-progress") // Matches the 'in-progress' status added to Schema
        .limit(1)
        .get();

    if (querySnapshot.empty) {
        logger.info(`No in-progress attempt found for user ${uid} on quiz ${quizId}`);
        return null;
    }

    const doc = querySnapshot.docs[0];
    logger.info(`Found in-progress attempt ${doc.id} for user ${uid}`);
    
    // Cast to QuizAttempt, ensuring ID is included
    return { id: doc.id, ...doc.data() } as QuizAttempt;
};

/**
 * Finds a specific attempt by ID (used for Review Mode).
 */
export const findAttemptById = async (uid: string, attemptId: string): Promise<QuizAttempt> => {
    const doc = await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).get();

    if (!doc.exists) {
        throw new Error("Attempt not found.");
    }
    return { id: doc.id, ...doc.data() } as QuizAttempt;
};

/**
 * Deletes a specific quiz attempt document.
 */
export const deleteAttempt = async (uid: string, attemptId: string): Promise<void> => {
    logger.info(`Deleting attempt: ${attemptId} for user: ${uid}`);
    await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).delete();
};

/**
 * Finalizes a quiz attempt, updating its status and score.
 */
export const finalizeAttempt = async (uid: string, attemptId: string, attemptState: QuizAttempt, score: number, totalQuestions: number): Promise<void> => {
    const finalAttemptState = { ...attemptState };

    // Ensure crossedOffOptions are stored as simple objects/arrays (Firestore doesn't support Sets)
    // Even though Zod Schema enforces arrays, we safeguard here in case of internal calls.
    if (finalAttemptState.crossedOffOptions) {
        finalAttemptState.crossedOffOptions = Object.fromEntries(
            Object.entries(finalAttemptState.crossedOffOptions).map(([key, value]) => [key, Array.from(value as any)])
        );
    }

    const finalData = {
        ...finalAttemptState,
        status: "completed",
        score: score,
        totalQuestions: totalQuestions,
        updatedAt: FieldValue.serverTimestamp(),
    };

    logger.info(`Finalizing attempt ${attemptId} for user ${uid} with score ${score}/${totalQuestions}`);
    await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).set(finalData, { merge: true });
};

/**
 * Retrieves all completed attempts for a specific quiz for a user.
 */
export const getCompletedAttempts = async (uid: string, identifiers: { topicId: string; sectionType: string; quizId: string }): Promise<QuizAttempt[]> => {
    const { topicId, sectionType, quizId } = identifiers;

    const querySnapshot = await db.collection("users").doc(uid).collection("quizAttempts")
        .where("topicId", "==", topicId)
        .where("sectionType", "==", sectionType)
        .where("quizId", "==", quizId)
        .where("status", "==", "completed")
        .orderBy("updatedAt", "desc")
        .get();

    if (querySnapshot.empty) {
        return [];
    }

    return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        
        // Handle Firestore timestamps vs Number timestamps
        // The client expects numbers (milliseconds) for sorting/display
        const timestamp = data.updatedAt || data.createdAt;
        const completedAt = timestamp && typeof timestamp.toMillis === 'function' 
            ? timestamp.toMillis() 
            : Date.now();

        return {
            ...data,
            id: doc.id,
            completedAt: completedAt,
        } as QuizAttempt;
    });
};