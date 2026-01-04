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
const stripePlusPriceId = defineSecret("STRIPE_PRICE_ID");
const stripeProPriceId = defineSecret("STRIPE_PRO_PRICE_ID");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// --- Initialization ---
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// --- Helper Functions ---
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


// --- v2 Public Data Functions ---
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
        topicStructure.practiceTests.push({ id: quizId, name: `Test ${num}`, storagePath: file.name, _sortOrder: sortOrder, topicName: formatDisplayName(topicId) });
      } else if (sectionTypeFolder === "question-bank") {
        const quizId = formatId(fileNameWithExt);
        const category = (parts.length > 4) ? formatDisplayName(parts[3]) : formatDisplayName(topicId);
        if (!topicStructure.questionBanks[category]) {
          topicStructure.questionBanks[category] = [];
        }
        topicStructure.questionBanks[category].push({ id: quizId, name: formatDisplayName(fileNameWithExt), storagePath: file.name, _sortOrder: sortOrder, qbCategory: category });
      }
    }
    topicStructure.practiceTests.sort((a, b) => a._sortOrder - b._sortOrder);
    const sortedCategories = Object.keys(topicStructure.questionBanks).sort();
    const sortedQuestionBanks = {};
    for (const category of sortedCategories) {
      topicStructure.questionBanks[category].sort((a, b) => a._sortOrder - b._sortOrder);
      sortedQuestionBanks[category] = topicStructure.questionBanks[category];
    }
    const banksArray = Object.entries(sortedQuestionBanks).map(([category, banks]) => ({ category, banks: banks.map((b) => ({ ...b, sectionType: "qbank" })) }));
    topicStructure.practiceTests = topicStructure.practiceTests.map((pt) => ({ ...pt, sectionType: "practice" }));
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
exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey, stripePlusPriceId, stripeProPriceId], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to make a purchase.");
    }
    const uid = request.auth.uid;
    const tierId = request.data.tierId;

    if (!tierId) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'tierId' argument.");
    }

    try {
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User document not found.");
      }

      const stripeInstance = new stripe(stripeSecretKey.value());
      
      let priceId;
      if (tierId === 'plus') {
        priceId = stripePlusPriceId.value();
      } else if (tierId === 'pro') {
        priceId = stripeProPriceId.value();
      } else {
        throw new HttpsError("invalid-argument", `Invalid tierId provided: ${tierId}`);
      }

      const liveAppUrl = "https://dental-edge-62624.web.app";
      logger.info(`Creating checkout for user: ${uid}, tier: ${tierId}, price: ${priceId}`);
      
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        success_url: `${liveAppUrl}/app?checkout=success`,
        cancel_url: `${liveAppUrl}/plans?checkout=cancel`,
        billing_address_collection: "required",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: { firebaseUID: uid },
      });
      return { id: session.id };

    } catch (error) {
      logger.error(`Stripe checkout session creation failed for user ${uid}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "An error occurred while creating the checkout session.");
    }
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret, stripePlusPriceId, stripeProPriceId] },
  async (request, response) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        request.headers["stripe-signature"],
        stripeWebhookSecret.value()
      );
    } catch (err) {
      logger.error("Webhook signature verification failed.", err);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const firebaseUID = session.metadata.firebaseUID;
      const stripeCustomerId = session.customer;
      
      const stripeInstance = new stripe(stripeSecretKey.value());
      const sessionWithLineItems = await stripeInstance.checkout.sessions.retrieve(
        session.id,
        { expand: ['line_items'] }
      );
      const priceId = sessionWithLineItems.line_items.data[0].price.id;

      let newTier = null;
      if (priceId === stripePlusPriceId.value()) {
        newTier = "plus";
      } else if (priceId === stripeProPriceId.value()) {
        newTier = "pro";
      }

      if (!firebaseUID || !newTier) {
        logger.error("Webhook received with missing firebaseUID or unknown priceId.", { session_id: session.id, price_id: priceId });
      } else {
        logger.info(`Processing successful checkout for user: ${firebaseUID} for tier: ${newTier}`);
        const userRef = db.collection("users").doc(firebaseUID);
        try {
          await userRef.update({ tier: newTier, stripeCustomerId });
          logger.info(`Successfully updated user ${firebaseUID} to '${newTier}' tier.`);
        } catch (err) {
          logger.error(`Failed to update user ${firebaseUID} in Firestore.`, err);
        }
      }
    } else {
      logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    response.status(200).send();
  }
);

// --- v2 CALLABLE FUNCTIONS FOR QUIZ ATTEMPTS ---

exports.saveInProgressAttempt = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to save progress.");
    }
    const { uid } = request.auth;
    const { topicId, sectionType, quizId, ...attemptState } = request.data;
    
    const dataToSave = {
        ...attemptState,
        topicId,
        sectionType,
        quizId,
        status: "in-progress",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const collectionRef = db.collection("users").doc(uid).collection("quizAttempts");
    
    if (attemptState.id) {
        logger.info(`Updating in-progress attempt: ${attemptState.id} for user: ${uid}`);
        await collectionRef.doc(attemptState.id).set(dataToSave, { merge: true });
        return { attemptId: attemptState.id };
    } else {
        logger.info(`Creating new in-progress attempt for user: ${uid}`);
        dataToSave.createdAt = admin.firestore.FieldValue.serverTimestamp();
        const newDocRef = await collectionRef.add(dataToSave);
        return { attemptId: newDocRef.id };
    }
});

exports.getInProgressAttempt = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const { uid } = request.auth;
    const { topicId, sectionType, quizId } = request.data;

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
});

exports.deleteInProgressAttempt = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const { uid } = request.auth;
    const { attemptId } = request.data;

    if (!attemptId) {
        throw new HttpsError("invalid-argument", "Function must be called with an 'attemptId'.");
    }

    logger.info(`Deleting in-progress attempt: ${attemptId} for user: ${uid}`);
    await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptId).delete();
    return { success: true };
});

exports.finalizeQuizAttempt = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to submit a quiz.");
    }
    const { uid } = request.auth;
    const { topicId, sectionType, quizId, ...attemptState } = request.data;

    if (!attemptState.id) {
        throw new HttpsError("invalid-argument", "Cannot finalize an attempt without an ID.");
    }
    
    const [allFiles] = await bucket.getFiles({ prefix: `data/${topicId}/` });
    
    let targetStoragePath = null;

    for (const file of allFiles) {
        const parts = file.name.split("/").filter(Boolean);
        if (parts.length < 4) continue;

        let currentQuizId;
        const fileName = parts[parts.length - 1];

        if (parts[2] === "practice-test") {
            const match = fileName.toLowerCase().match(/test_(\d+)/);
            if (match) {
                currentQuizId = `test-${match[1]}`;
            }
        } else if (parts[2] === "question-bank") {
            currentQuizId = formatId(fileName);
        }

        if (currentQuizId === quizId) {
            targetStoragePath = file.name;
            break;
        }
    }

    if (!targetStoragePath) {
        logger.error("Could not find storage path for quiz.", { topicId, sectionType, quizId });
        throw new HttpsError("not-found", `Could not find quiz data file for ${quizId}.`);
    }
    
    const [quizDataBuffer] = await bucket.file(targetStoragePath).download();
    const quizData = JSON.parse(quizDataBuffer.toString());

    let score = 0;
    quizData.forEach((question, index) => {
        const correctOption = question.options.find(opt => opt.is_correct);
        if (correctOption && attemptState.userAnswers[index] === correctOption.label) {
            score++;
        }
    });

    const finalAttemptState = { ...attemptState };
    if (finalAttemptState.crossedOffOptions) {
         finalAttemptState.crossedOffOptions = Object.fromEntries(
            Object.entries(finalAttemptState.crossedOffOptions).map(([key, value]) => [key, Array.from(value)])
        );
    }

    const finalData = {
        ...finalAttemptState,
        topicId,
        sectionType,
        quizId,
        status: "completed",
        score: score,
        totalQuestions: quizData.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    logger.info(`Finalizing attempt ${attemptState.id} for user ${uid} with score ${score}/${quizData.length}`);
    await db.collection("users").doc(uid).collection("quizAttempts").doc(attemptState.id).set(finalData, { merge: true });

    return { attemptId: attemptState.id, score: score };
});

exports.getCompletedAttemptsForQuiz = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to view attempts.");
    }
    const { uid } = request.auth;
    const { topicId, sectionType, quizId } = request.data;

    if (!topicId || !sectionType || !quizId) {
        throw new HttpsError("invalid-argument", "Missing required quiz identifiers.");
    }

    try {
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

        const attempts = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const timestamp = data.updatedAt || data.createdAt;
            const completedAt = timestamp ? timestamp._seconds * 1000 : Date.now();
            
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

        return attempts;

    } catch (error) {
        logger.error("Error fetching completed attempts:", { uid, quizId, error: error.message });
        throw new HttpsError("internal", "An unexpected error occurred while fetching attempts.");
    }
});

// --- THIS IS THE NEW FUNCTION ---
exports.getQuizAnalytics = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to view analytics.");
    }

    const { topicId, sectionType, quizId } = request.data;
    if (!topicId || !sectionType || !quizId) {
        throw new HttpsError("invalid-argument", "Missing required quiz identifiers.");
    }

    const [allFiles] = await bucket.getFiles({ prefix: `data/${topicId}/` });
    let targetStoragePath = null;
    for (const file of allFiles) {
        const parts = file.name.split("/").filter(Boolean);
        if (parts.length < 4) continue;
        let currentQuizId;
        const fileName = parts[parts.length - 1];
        if (parts[2] === "practice-test") {
            const match = fileName.toLowerCase().match(/test_(\d+)/);
            if (match) currentQuizId = `test-${match[1]}`;
        } else if (parts[2] === "question-bank") {
            currentQuizId = formatId(fileName);
        }
        if (currentQuizId === quizId) {
            targetStoragePath = file.name;
            break;
        }
    }

    if (!targetStoragePath) {
        logger.error("Could not find storage path for analytics.", { topicId, sectionType, quizId });
        throw new HttpsError("not-found", `Could not find quiz data file for ${quizId}.`);
    }

    try {
        const [quizDataBuffer] = await bucket.file(targetStoragePath).download();
        const fullQuizData = JSON.parse(quizDataBuffer.toString());

        const analyticsData = fullQuizData.map(q => ({
            analytics: q.analytics,
            category: q.category,
            options: q.options.map(opt => ({ label: opt.label, is_correct: opt.is_correct }))
        }));

        return analyticsData;
    } catch (error) {
        logger.error("Error reading or processing quiz data for analytics", { error: error.message });
        throw new HttpsError("internal", "Failed to retrieve quiz analytics.");
    }
});
