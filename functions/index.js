// FILE: functions/index.js

const functions = require("firebase-functions/v1");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- Helper Functions ---
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

// --- createUserDocument Function ---
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


// --- getTopics Function ---
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
    response.status(500).send("Internal Server Error");
  }
});

// --- getTopicStructure Function ---
exports.getTopicStructure = onRequest({cors: true}, async (request, response) => {
  const {topicId} = request.query;
  if (!topicId) {
    return response.status(400).send("Bad Request: Missing topicId parameter.");
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
    const sortOrder = getSortOrder(fileNameWithExt);

    const isPracticeTest = sectionTypeFolder === "practice-test" &&
      fileNameWithExt.toLowerCase().startsWith("test_");

    if (isPracticeTest) {
      const match = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
      const num = match ? parseInt(match[1], 10) : sortOrder;
      const quizId = `test-${num}`;

      topicStructure.practiceTests.push({
        id: quizId,
        name: `Test ${num}`,
        storagePath: file.name,
        _sortOrder: sortOrder,
        topicName: formatDisplayName(topicId),
      });
    } else if (sectionTypeFolder === "question-bank") {
      const quizId = formatId(fileNameWithExt);
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


// --- getQuizData Function ---
exports.getQuizData = onRequest({cors: true}, async (request, response) => {
  const {topicId, sectionType, quizId} = request.query;
  if (!topicId || !sectionType || !quizId) {
    return response.status(400).send("Bad Request: Missing parameters.");
  }

  const bucket = admin.storage().bucket();
  const prefix = `data/${topicId}/${sectionType === "practice" ? "practice-test" : "question-bank"}/`;
  const [files] = await bucket.getFiles({prefix});

  let requestedQuizMeta = null;
  const allQuizzes = files
      .filter((file) => file.name.endsWith(".json"))
      .map((file) => {
        const fileNameWithExt = file.name.split("/").pop();
        const sortOrder = getSortOrder(fileNameWithExt);
        let id;
        if (sectionType === "practice" && fileNameWithExt.toLowerCase().startsWith("test_")) {
          const match = fileNameWithExt.toLowerCase().match(/test_(\d+)/);
          const num = match ? parseInt(match[1], 10) : sortOrder;
          id = `test-${num}`;
        } else {
          id = formatId(fileNameWithExt);
        }
        return {id, storagePath: file.name, _sortOrder: sortOrder};
      })
      .sort((a, b) => a._sortOrder - b._sortOrder);

  if (allQuizzes.length > 0) {
    requestedQuizMeta = allQuizzes.find((q) => q.id === quizId);
  }

  if (!requestedQuizMeta) {
    return response.status(404).send("Not Found: Quiz data not found.");
  }

  const isBiologyTest1 = topicId === "biology" && sectionType === "practice" &&
                         allQuizzes[0] && requestedQuizMeta.id === allQuizzes[0].id;

  if (!request.headers.authorization && isBiologyTest1) {
    logger.info(`Unregistered user preview for: ${requestedQuizMeta.storagePath}`);
    try {
      const [data] = await bucket.file(requestedQuizMeta.storagePath).download();
      const quizData = JSON.parse(data.toString());
      return response.status(200).json(quizData.slice(0, 2));
    } catch (e) {
      logger.error("Error serving unregistered preview", e);
      return response.status(500).send("Internal Server Error");
    }
  }

  if (!request.headers.authorization || !request.headers.authorization.startsWith("Bearer ")) {
    logger.error("Unauthorized: No Firebase ID token was provided.");
    return response.status(401).send("Unauthorized");
  }

  const idToken = request.headers.authorization.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    logger.error("Forbidden: Invalid Firebase ID token.", error);
    return response.status(403).send("Forbidden");
  }

  const uid = decodedToken.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    logger.error(`User document not found for UID: ${uid}`);
    return response.status(403).send("Forbidden: User profile not found.");
  }

  const userTier = userDoc.data().tier;

  if (userTier === "plus" || userTier === "pro") {
    logger.info(`Access granted for tier '${userTier}' to ${requestedQuizMeta.storagePath}`);
    const [data] = await bucket.file(requestedQuizMeta.storagePath).download();
    return response.status(200).send(data);
  }

  if (userTier === "free") {
    const isFirstPracticeTest = sectionType === "practice" && allQuizzes[0] &&
                                requestedQuizMeta.id === allQuizzes[0].id;
    const isFirstQuestionBank = sectionType === "qbank" && allQuizzes[0] &&
                                requestedQuizMeta.id === allQuizzes[0].id;

    if (isFirstPracticeTest || isFirstQuestionBank) {
      logger.info(`Access granted for 'free' tier to ${requestedQuizMeta.storagePath}`);
      const [data] = await bucket.file(requestedQuizMeta.storagePath).download();
      return response.status(200).send(data);
    }
  }

  logger.warn(`Access DENIED for tier '${userTier}' to ${requestedQuizMeta.storagePath}`);
  return response.status(403).json({
    error: "upgrade_required",
    message: `This content requires a higher tier plan.`,
  });
});