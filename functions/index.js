const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const logger = require("firebase-functions/logger");

// Initialize the Firebase Admin SDK. This is a one-time setup.
admin.initializeApp();

// Create a configured CORS middleware handler.
const corsHandler = cors({origin: true});

// --- Helper Functions ---

// Formats a raw folder/file name into a user-friendly display name.
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

// --- Cloud Functions ---

exports.getQuizData = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    logger.info("getQuizData function triggered.");

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.error("Unauthorized: No authorization token was provided.");
      response.status(401).send("Unauthorized");
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      logger.info(`Request authenticated for user: ${decodedToken.uid}`);

      const {topicId, sectionType, quizId} = request.query;

      if (!topicId || !sectionType || !quizId) {
        logger.error("Bad Request: Missing required query parameters.");
        response.status(400).send("Bad Request: Missing required parameters.");
        return;
      }

      const validPathRegex = /^[a-zA-Z0-9-]+$/;
      if (
        !validPathRegex.test(topicId) ||
        !validPathRegex.test(sectionType) ||
        !validPathRegex.test(quizId)
      ) {
        logger.error("Bad Request: Invalid characters in query parameters.", {
          topicId,
          sectionType,
          quizId,
        });
        response
            .status(400)
            .send("Bad Request: Invalid characters in parameters.");
        return;
      }

      const bucket = admin.storage().bucket();
      const filePath = `data/${topicId}/${sectionType}/${quizId}.json`;
      logger.info(`Attempting to retrieve file: ${filePath}`);

      const file = bucket.file(filePath);
      const [data] = await file.download();

      const quizContent = JSON.parse(data.toString("utf8"));
      response.status(200).json(quizContent);
    } catch (error) {
      const {code, message} = error;
      if (code === "auth/id-token-expired" || code === "auth/argument-error") {
        logger.error("Authentication error:", error);
        response.status(403).send("Forbidden: Invalid authentication token.");
      } else if (code === 404) {
        logger.error(`File not found at path: ${message}`);
        response
            .status(404)
            .send("Not Found: The requested quiz data does not exist.");
      } else {
        logger.error("Internal error in getQuizData:", error);
        response.status(500).send("Internal Server Error");
      }
    }
  });
});

exports.getTopics = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    logger.info("getTopics function triggered.");

    const bucket = admin.storage().bucket();
    const options = {
      prefix: "data/",
      delimiter: "/",
    };

    try {
      // Corrected: We only need the third element (apiResponse) from the array.
      // Using ",," is a valid way to ignore the first two elements.
      const [, , apiResponse] = await bucket.getFiles(options);

      const prefixes = apiResponse.prefixes || [];

      const topicIds = prefixes.map((prefix) => {
        const parts = prefix.slice(0, -1).split("/");
        const topicId = parts[parts.length - 1];
        return {
          id: topicId,
          name: formatDisplayName(topicId),
        };
      });

      response.status(200).json(topicIds);
    } catch (error) {
      logger.error("Error fetching topics from Cloud Storage:", error);
      response
          .status(500)
          .send("Internal Server Error: Could not retrieve topics.");
    }
  });
});
