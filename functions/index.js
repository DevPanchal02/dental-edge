// FILE: functions/index.js

const functionsV1 = require("firebase-functions/v1");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const stripe = require("stripe");

// --- Secret Management ---
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePriceId = defineSecret("STRIPE_PRICE_ID");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// --- Initialization ---
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// --- Helper Functions (Full Implementation) ---
const formatDisplayName = (rawName) => {
  if (!rawName) return "";
  return rawName.replace(/[-_]/g, " ").replace(/\.json$/i, "").replace(/^\d+\s*/, "").trim().replace(/\b\w/g, (char) => char.toUpperCase());
};
const formatId = (rawName) => {
  if (!rawName) return "";
  const baseName = rawName.replace(/\.json$/i, "");
  return baseName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]+/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
};
const getSortOrder = (fileName) => {
  const matchTest = fileName.match(/^(?:Test_)?(\d+)/i);
  if (matchTest) return parseInt(matchTest[1], 10);
  const generalNumberMatch = fileName.match(/^(\d+)/);
  if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);
  return Infinity;
};

// --- v1 Auth Trigger Function ---
exports.createUserDocument = functionsV1.auth.user().onCreate((user) => {
  const { uid, email, displayName } = user;
  logger.info(`New user signed up: ${uid}, Email: ${email}`);
  const newUserRef = db.collection("users").doc(uid);
  return newUserRef.set({
    email: email,
    displayName: displayName || null,
    tier: "free",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    stripeCustomerId: null,
  }).then(() => {
    logger.info(`Successfully created Firestore doc for user: ${uid}`);
    return null;
  }).catch((error) => {
    logger.error(`Error creating Firestore doc for user: ${uid}`, error);
    throw error;
  });
});


// --- v2 Public Data Functions (Corrected with CORS Wrappers) ---

exports.getTopics = onRequest(async (request, response) => {
  cors(request, response, async () => {
    logger.info("getTopics function triggered.");
    const options = { prefix: "data/", delimiter: "/" };
    try {
      const [, , apiResponse] = await bucket.getFiles(options);
      const prefixes = apiResponse.prefixes || [];
      const topicIds = prefixes.map((prefix) => {
        const parts = prefix.slice(0, -1).split("/");
        const topicId = parts[parts.length - 1];
        return { id: topicId, name: formatDisplayName(topicId) };
      });
      response.status(200).json(topicIds);
    } catch (error) {
      logger.error("Error fetching topics:", error);
      response.status(500).send("Internal Server Error");
    }
  });
});

exports.getTopicStructure = onRequest(async (request, response) => {
  cors(request, response, async () => {
    const { topicId } = request.query;
    if (!topicId) {
      return response.status(400).send("Bad Request: Missing topicId parameter.");
    }
    logger.info(`getTopicStructure triggered for topicId: ${topicId}`);
    const [files] = await bucket.getFiles({ prefix: `data/${topicId}/` });
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
      topicStructure.questionBanks[category].sort((a, b) => a._sortOrder - b._sortOrder);
      sortedQuestionBanks[category] = topicStructure.questionBanks[category];
    }
    const banksArray = Object.entries(sortedQuestionBanks).map(([category, banks]) => ({
      category,
      banks: banks.map((b) => ({ ...b, sectionType: "qbank" })),
    }));
    topicStructure.practiceTests = topicStructure.practiceTests.map((pt) => ({
      ...pt,
      sectionType: "practice",
    }));
    topicStructure.questionBanks = banksArray;
    response.status(200).json(topicStructure);
  });
});

exports.getQuizData = onRequest(async (request, response) => {
  cors(request, response, async () => {
    const { storagePath, isPreview } = request.query;
    if (!storagePath) {
      return response.status(400).send("Bad Request: Missing storagePath parameter.");
    }
    if (isPreview === "true") {
      logger.info("Unregistered preview request received.", { storagePath });
      try {
        const [data] = await bucket.file(storagePath).download();
        const quizData = JSON.parse(data.toString());
        logger.info({ message: "Content Access Request", userTier: "unregistered_preview", storagePath, accessDecision: "granted_preview", contentType: "preview" });
        response.status(200).json(quizData.slice(0, 2));
      } catch (e) {
        logger.error("Error serving quiz preview", { error: e.message, storagePath });
        response.status(500).send("Internal Server Error");
      }
      return;
    }
    const idToken = request.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
      return response.status(401).send("Unauthorized: Missing auth token.");
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        logger.warn("User document not found for authenticated user.", { uid });
        return response.status(403).send("Forbidden: User profile not found.");
      }
      const userTier = userDoc.data().tier || "free";
      const isFreeContent = storagePath.includes("Test_1_Data.json") || storagePath.includes("1_") || storagePath.endsWith("_1.json");
      let hasAccess = false;
      if (isFreeContent || userTier === "plus" || userTier === "pro") hasAccess = true;
      logger.info({ message: "Content Access Request", uid, userTier, storagePath, accessDecision: hasAccess ? "granted" : "denied", contentType: isFreeContent ? "free" : "paid" });
      if (!hasAccess) {
        return response.status(403).json({ error: "upgrade_required", message: "A higher tier is required to access this content." });
      }
      const [data] = await bucket.file(storagePath).download();
      response.setHeader("Content-Type", "application/json");
      response.status(200).send(data);
    } catch (error) {
      if (error.code === "auth/id-token-expired") {
        logger.warn("Expired auth token received.", { error: error.message });
        return response.status(403).send("Forbidden: Auth token has expired.");
      } else {
        logger.error("Error in getQuizData function", { error: error.message, storagePath });
        return response.status(500).send("Internal Server Error");
      }
    }
  });
});

// --- v2 STRIPE PAYMENT FUNCTIONS ---
exports.createCheckoutSession = onCall({ secrets: [stripeSecretKey, stripePriceId], cors: true }, async (request) => {
  if (!request.auth) {
    logger.error("createCheckoutSession call is not authenticated.");
    throw new HttpsError("unauthenticated", "You must be logged in to make a purchase.");
  }
  const uid = request.auth.uid;
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      logger.error(`User document not found for authenticated user: ${uid}`);
      throw new HttpsError("not-found", "User document not found.");
    }
    const stripeInstance = new stripe(stripeSecretKey.value());
    const price = stripePriceId.value();
    const liveAppUrl = "https://dental-edge-62624.web.app";
    logger.info(`Creating checkout session for user: ${uid} for price: ${price}`);
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      success_url: `${liveAppUrl}/app?checkout=success`,
      cancel_url: `${liveAppUrl}/plans?checkout=cancel`,
      billing_address_collection: "required",
      line_items: [{ price, quantity: 1 }],
      metadata: { firebaseUID: uid },
    });
    return { id: session.id };
  } catch (error) {
    logger.error(`Stripe checkout session creation failed for user ${uid}:`, error);
    throw new HttpsError("internal", "An error occurred while creating the checkout session.");
  }
});

exports.stripeWebhook = onRequest({ secrets: [stripeWebhookSecret] }, async (request, response) => {
  let event;
  try {
    // 1. Verify the event came from Stripe using the webhook secret
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      request.headers["stripe-signature"],
      stripeWebhookSecret.value()
    );
  } catch (err) {
    logger.error("Webhook signature verification failed.", err);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Handle the specific event type
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const firebaseUID = session.metadata.firebaseUID;
    const stripeCustomerId = session.customer;

    if (!firebaseUID) {
      logger.error("Webhook received 'checkout.session.completed' with no firebaseUID in metadata.", { session_id: session.id });
    } else {
      logger.info(`Processing successful checkout for user: ${firebaseUID}`);
      const userRef = db.collection("users").doc(firebaseUID);
      try {
        await userRef.update({
          tier: "plus",
          stripeCustomerId: stripeCustomerId,
        });
        logger.info(`Successfully updated user ${firebaseUID} to 'plus' tier.`);
      } catch (err) {
        logger.error(`Failed to update user ${firebaseUID} in Firestore.`, err);
      }
    }
  } else {
    logger.info(`Unhandled Stripe event type: ${event.type}`);
  }

  // 3. Acknowledge receipt of the event to Stripe
  response.status(200).send();
});
