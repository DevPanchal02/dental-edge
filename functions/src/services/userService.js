// FILE: functions/src/services/userService.js

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

const db = admin.firestore();

/**
 * Retrieves the user's subscription tier from their Firestore document.
 * @param {string} uid The user's ID.
 * @returns {Promise<string>} The user's tier ('free', 'plus', 'pro').
 */
const getUserTier = async (uid) => {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    logger.warn("User document not found for authenticated user.", { uid });
    // This case should be rare but is a safeguard.
    return "free";
  }
  return userDoc.data().tier || "free";
};

/**
 * Saves or creates an in-progress quiz attempt for a user.
 * @param {string} uid The user's ID.
 * @param {object} attemptData The full data of the attempt to save.
 * @returns {Promise<string>} The ID of the saved attempt document.
 */
const saveAttempt = async (uid, attemptData) => {
  const collectionRef = db.collection("users").doc(uid).collection("quizAttempts");
  const { id, ...dataToSave } = attemptData;

  dataToSave.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (id) {
    logger.info(`Updating in-progress attempt: ${id} for user: ${uid}`);
    await collectionRef.doc(id).set(dataToSave, { merge: true });
    return id;
  } else {
    logger.info(`Creating new in-progress attempt for user: ${uid}`);
    dataToSave.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const newDocRef = await collectionRef.add(dataToSave);
    return newDocRef.id;
  }
};

/**
 * Finds a user's most recent in-progress attempt for a specific quiz.
 * @param {string} uid The user's ID.
 * @param {object} identifiers - Contains topicId, sectionType, quizId.
 * @returns {Promise<object|null>} The attempt data or null if not found.
 */
const findInProgressAttempt = async (uid, { topicId, sectionType, quizId }) => {
  const querySnapshot = await db.collection("users").doc(uid).collection("quizAttempts")
    .where("topicId", "==", topicId)
    .where("sectionType", "==", sectionType)
    .where("quizId", "==", quizId)
    .where("status", "==", "in-progress")
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    logger.info(`No in-progress attempt found for user ${uid} on quiz ${quizId}`);
    return null;
  }

  const doc = querySnapshot.docs[0];
  logger.info(`Found in-progress attempt ${doc.id} for user ${uid}`);
  return { id: doc.id, ...doc.data() };
};

/**
 * Finds a specific attempt by ID (used for Review Mode).
 * @param {string} uid The user's ID.
 * @param {string} attemptId The ID of the attempt.
 * @returns {Promise<object>} The attempt data.
 */
const findAttemptById = async (uid, attemptId) => {
  const doc = await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).get();
  
  if (!doc.exists) {
    throw new Error("Attempt not found.");
  }
  return { id: doc.id, ...doc.data() };
};

/**
 * Deletes a specific quiz attempt document.
 * @param {string} uid The user's ID.
 * @param {string} attemptId The ID of the attempt to delete.
 * @returns {Promise<void>}
 */
const deleteAttempt = async (uid, attemptId) => {
  logger.info(`Deleting attempt: ${attemptId} for user: ${uid}`);
  await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).delete();
};

/**
 * Finalizes a quiz attempt, updating its status and score.
 * @param {string} uid The user's ID.
 * @param {string} attemptId The ID of the attempt document.
 * @param {object} attemptState The final state of the user's answers.
 * @param {number} score The calculated score.
 * @param {number} totalQuestions The total number of questions in the quiz.
 * @returns {Promise<void>}
 */
const finalizeAttempt = async (uid, attemptId, attemptState, score, totalQuestions) => {
  const finalAttemptState = { ...attemptState };
  // Sanitize crossedOffOptions from a Set-like object to an array for Firestore
  if (finalAttemptState.crossedOffOptions) {
    finalAttemptState.crossedOffOptions = Object.fromEntries(
      Object.entries(finalAttemptState.crossedOffOptions).map(([key, value]) => [key, Array.from(value)])
    );
  }

  const finalData = {
    ...finalAttemptState,
    status: "completed",
    score: score,
    totalQuestions: totalQuestions,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  logger.info(`Finalizing attempt ${attemptId} for user ${uid} with score ${score}/${totalQuestions}`);
  await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).set(finalData, { merge: true });
};

/**
 * Retrieves all completed attempts for a specific quiz for a user.
 * @param {string} uid The user's ID.
 * @param {object} identifiers - Contains topicId, sectionType, quizId.
 * @returns {Promise<Array<object>>} A list of completed attempts.
 */
const getCompletedAttempts = async (uid, { topicId, sectionType, quizId }) => {
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
    const timestamp = data.updatedAt || data.createdAt;
    const completedAt = timestamp ? timestamp.toMillis() : Date.now();

    return {
      id: doc.id,
      score: data.score,
      totalQuestions: data.totalQuestions,
      completedAt: completedAt,
      userAnswers: data.userAnswers,
      topicId: data.topicId,
      sectionType: data.sectionType,
      quizId: data.quizId,
    };
  });
};

module.exports = {
  getUserTier,
  saveAttempt,
  findInProgressAttempt,
  findAttemptById,
  deleteAttempt,
  finalizeAttempt,
  getCompletedAttempts,
};
