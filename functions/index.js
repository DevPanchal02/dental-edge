// FILE: functions/index.js

const { onRequest, onCall } = require("firebase-functions/v2/https");
const functionsV1 = require("firebase-functions/v1"); // For Auth trigger
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// --- Initialization MUST happen before importing controllers ---
// This ensures that when services load 'admin.firestore()', the app is ready.
admin.initializeApp();

const cors = require("cors")({ origin: true });
const stripe = require("stripe");

// --- Controller Imports ---
const topicController = require("./src/controllers/topicController");
const quizController = require("./src/controllers/quizController");
const userController = require("./src/controllers/userController");
const stripeController = require("./src/controllers/stripeController");

// --- Secret Management ---
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePlusPriceId = defineSecret("STRIPE_PRICE_ID");
const stripeProPriceId = defineSecret("STRIPE_PRO_PRICE_ID");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// ==================================================================
// 1. PUBLIC DATA ENDPOINTS (HTTP)
// ==================================================================

exports.getTopics = onRequest(async (req, res) => {
  cors(req, res, () => topicController.getTopics(req, res));
});

exports.getTopicStructure = onRequest(async (req, res) => {
  cors(req, res, () => topicController.getTopicStructure(req, res));
});

exports.getQuizData = onRequest(async (req, res) => {
  cors(req, res, () => quizController.getQuizData(req, res));
});


// ==================================================================
// 2. QUIZ & USER LOGIC (CALLABLE)
// ==================================================================

exports.saveInProgressAttempt = onCall({ cors: true }, quizController.saveInProgressAttempt);

exports.getInProgressAttempt = onCall({ cors: true }, quizController.getInProgressAttempt);

// --- FIX: Added missing export for getQuizAttemptById ---
exports.getQuizAttemptById = onCall({ cors: true }, quizController.getQuizAttemptById); 

exports.deleteInProgressAttempt = onCall({ cors: true }, quizController.deleteInProgressAttempt);

exports.finalizeQuizAttempt = onCall({ cors: true }, quizController.finalizeQuizAttempt);

exports.getQuizAnalytics = onCall({ cors: true }, quizController.getQuizAnalytics);

exports.getCompletedAttemptsForQuiz = onCall({ cors: true }, quizController.getCompletedAttempts);


// ==================================================================
// 3. AUTH TRIGGERS (BACKGROUND)
// ==================================================================

exports.createUserDocument = functionsV1.auth.user().onCreate(userController.onUserCreated);


// ==================================================================
// 4. PAYMENTS (STRIPE)
// ==================================================================

exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey, stripePlusPriceId, stripeProPriceId], cors: true },
  (request) => {
    // Dependency Injection: Pass the Stripe instance and config to the controller
    const config = {
      stripe: new stripe(stripeSecretKey.value()),
      prices: {
        plus: stripePlusPriceId.value(),
        pro: stripeProPriceId.value(),
      },
    };
    return stripeController.createCheckoutSession(request, config);
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret, stripePlusPriceId, stripeProPriceId] },
  (req, res) => {
    const config = {
      stripe: new stripe(stripeSecretKey.value()),
      endpointSecret: stripeWebhookSecret.value(),
      prices: {
        plus: stripePlusPriceId.value(),
        pro: stripeProPriceId.value(),
      },
    };
    return stripeController.handleWebhook(req, res, config);
  }
);

