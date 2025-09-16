// FILE: functions/index.js - FINAL CORRECTED VERSION V2

const functions = require("firebase-functions/v1"); // <-- THE CRITICAL FIX IS HERE
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- Helper Functions (No changes needed) ---
const formatDisplayName = (rawName) => {
  if (!rawName) {
    return "";
  }
  return rawName
      .replace(/[-_]/g, " ")
      .replace(/\.json$/i, "")
      .replace(/^\d+\s*/, "")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatId = (rawName) => {
  if (!rawName) return "";
  const baseName = rawName.replace(/\.json$/i, "");
  return baseName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
};

const getSortOrder = (fileName) => {
  const matchTest = fileName.match(/^(?:Test_)?(\d+)/i);
  if (matchTest) return parseInt(matchTest[1], 10);
  const generalNumberMatch = fileName.match(/^(\d+)/);
  if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);
  return Infinity;
};

// --- NEW FUNCTION (Stable v1 Syntax) ---
/**
 * Handles the creation of a new user account.
 * This function is triggered when a new user is created in Firebase Auth.
 * It creates a corresponding document in the 'users' collection in Firestore.
 */
exports.createUserDocument = functions.auth.user().onCreate((user) => {
  const {uid, email, displayName} = user;
  logger.info(`New user signed up: ${uid}, Email: ${email}`);

  const newUserRef = db.collection("users").doc(uid);

  return newUserRef.set({
    email: email,
    displayName: displayName || null,
    tier: "free",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    stripeCustomerId: null,
  })
      .then(() => {
        logger.info(`Successfully created Firestore doc for user: ${uid}`);
        return null;
      })
      .catch((error) => {
        logger.error(`Error creating Firestore doc for user: ${uid}`, error);
        throw error;
      });
});


// --- Existing Cloud Functions (Modern v2 Syntax) ---

/**
 * [PUBLIC] Gets the list of top-level topics.
 */
exports.getTopics = onRequest({cors: true}, async (request, response) => {
  logger.info("getTopics function triggered.");
  const bucket = admin.storage().bucket();
  const options = {prefix: "data/", delimiter: "/"};
  try {
    const [, , apiResponse] = await bucket.getFiles(options);
    const prefixes = apiResponse.prefixes || [];
    const topicIds = prefixes.map((prefix) => {
      const parts = prefix.slice(0, -1).split("/");
      const topicId = parts[parts.length - 1];
      return {id: topicId, name: formatDisplayName(topicId)};
    });
    response.status(200).json(topicIds);
  } catch (error) {
    logger.error("Error fetching topics:", error);
    response
        .status(500)
        .send("Internal Server Error: Could not retrieve topics.");
  }
});

/**
 * [PUBLIC] Gets the detailed structure of a single topic.
 */
exports.getTopicStructure = onRequest({cors: true}, async (request, response) => {
  const {topicId} = request.query;
  if (!topicId) {
    response.status(400).send("Bad Request: Missing topicId parameter.");
    return;
  }
  logger.info(`getTopicStructure triggered for topicId: ${topicId}`);

  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({prefix: `data/${topicId}/`});

  const topicStructure = {
    id: topicId,
    name: formatDisplayName(topicId),
    practiceTests: [],
    questionBanks: {},
  };

  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    const parts = file.name.split("/").filter((p) => p);
    if (parts.length < 4) continue;
    const sectionTypeFolder = parts[2];
    const fileNameWithExt = parts[parts.length - 1];
    const quizId = formatId(fileNameWithExt);
    const sortOrder = getSortOrder(fileNameWithExt);
    const isPracticeTest = sectionTypeFolder === "practice-test" &&
      fileNameWithExt.toLowerCase().startsWith("test_");
    if (isPracticeTest) {
      const match = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
      const num = match ? parseInt(match[1], 10) : sortOrder;
      topicStructure.practiceTests.push({
        id: quizId,
        name: `Test ${num}`,
        storagePath: file.name,
        _sortOrder: sortOrder,
        topicName: formatDisplayName(topicId),
      });
    } else if (sectionTypeFolder === "question-bank") {
      const category = (parts.length > 4) ?
        formatDisplayName(parts[3]) : formatDisplayName(topicId);
      if (!topicStructure.questionBanks[category]) {
        topicStructure.questionBanks[category] = [];
      }
      topicStructure.questionBanks[category].push({
        id: quizId,
        name: formatDisplayName(fileNameWithExt),
        storagePath: file.name,
        _sortOrder: sortOrder,
        qbCategory: category,
      });
    }
  }

  topicStructure.practiceTests.sort((a, b) => a._sortOrder - b._sortOrder);
  const sortedCategories = Object.keys(topicStructure.questionBanks).sort();
  const sortedQuestionBanks = {};
  for (const category of sortedCategories) {
    topicStructure.questionBanks[category]
        .sort((a, b) => a._sortOrder - b._sortOrder);
    sortedQuestionBanks[category] = topicStructure.questionBanks[category];
  }
  const banksArray = Object.entries(sortedQuestionBanks)
      .map(([category, banks]) => ({
        category,
        banks: banks.map((b) => ({...b, sectionType: "qbank"})),
      }));
  topicStructure.practiceTests = topicStructure.practiceTests.map((pt) => ({
    ...pt, sectionType: "practice",
  }));
  topicStructure.questionBanks = banksArray;
  response.status(200).json(topicStructure);
});

/**
 * [TEMPORARILY PUBLIC] Fetches the raw data for a single quiz file.
 */
exports.getQuizData = onRequest({cors: true}, async (request, response) => {
  const {storagePath} = request.query;
  if (!storagePath) {
    response.status(400)
        .send("Bad Request: Missing 'storagePath' parameter.");
    return;
  }
  if (!storagePath.startsWith("data/") || storagePath.includes("..")) {
    logger.error(`Forbidden Access Attempt: Invalid path "${storagePath}"`);
    response.status(403).send("Forbidden");
    return;
  }
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [data] = await file.download();
    response.setHeader("Content-Type", "application/json");
    response.status(200).send(data);
  } catch (error) {
    logger.error(`Failed to retrieve file from GCS: ${storagePath}`, error);
    if (error.code === 404) {
      response.status(404)
          .send("Not Found: The requested quiz file does not exist.");
    } else {
      response.status(500).send("Internal Server Error");
    }
  }
});
