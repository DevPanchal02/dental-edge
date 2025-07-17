// FILE: functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const logger = require("firebase-functions/logger");

admin.initializeApp();
const corsHandler = cors({origin: true});

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

// --- Cloud Functions ---

/**
 * [PUBLIC] Gets the list of top-level topics.
 */
exports.getTopics = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
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
});

/**
 * [PUBLIC] Gets the detailed structure of a single topic.
 */
exports.getTopicStructure = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
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
    const sortedCategories = Object.keys(topicStructure.questionBanks)
        .sort((a, b) => {
          const numA = parseInt(
              a.match(/^(\d+)/)?.[1] || a.match(/Passage #?(\d+)/i)?.[1],
          );
          const numB = parseInt(
              b.match(/^(\d+)/)?.[1] || b.match(/Passage #?(\d+)/i)?.[1],
          );
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });

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
});


/**
 * [TEMPORARILY PUBLIC] Fetches the raw data for a single quiz file.
 * We will re-enable authentication for this function in Phase 5.
 */
exports.getQuizData = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    // [SECURITY] Start of Authentication Gate. COMMENTED OUT FOR DEVELOPMENT.
    // We will re-enable this entire block in Phase 5 after implementing login.
    /*
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.error("Unauthorized: No Firebase ID token was provided.");
      response.status(401).send("Unauthorized");
      return;
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      logger.error("Forbidden: Invalid Firebase ID token.", error);
      response.status(403).send("Forbidden");
      return;
    }
    */
    // [SECURITY] End of Authentication Gate.

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
});
