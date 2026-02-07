import { onRequest, onCall } from "firebase-functions/v2/https";
import * as functionsV1 from "firebase-functions/v1";
import { defineSecret } from "firebase-functions/params";
import cors from "cors";
import Stripe from "stripe";

// Ensure Firebase App is initialized before anything else
import "./firebase";

// Import Controllers
import * as topicController from "./controllers/topicController";
import * as quizController from "./controllers/quizController";
import * as userController from "./controllers/userController";
import * as stripeController from "./controllers/stripeController";

// Initialize CORS middleware
// The 'cors' function is the default export
const corsHandler = cors({ origin: true });

// Define Secrets
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePlusPriceId = defineSecret("STRIPE_PRICE_ID");
const stripeProPriceId = defineSecret("STRIPE_PRO_PRICE_ID");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// ==================================================================
// 1. PUBLIC DATA ENDPOINTS (HTTP)
// ==================================================================

// Standardize HTTP wrappers to delegate async handling to the controllers
export const getTopics = onRequest((req, res) => {
    corsHandler(req as any, res as any, () => {
        topicController.getTopics(req as any, res as any);
    });
});

export const getTopicStructure = onRequest((req, res) => {
    corsHandler(req as any, res as any, () => {
        topicController.getTopicStructure(req as any, res as any);
    });
});

export const getQuizData = onRequest((req, res) => {
    corsHandler(req as any, res as any, () => {
        quizController.getQuizData(req as any, res as any);
    });
});


// ==================================================================
// 2. QUIZ & USER LOGIC (CALLABLE)
// ==================================================================

export const saveInProgressAttempt = onCall({ cors: true }, quizController.saveInProgressAttempt);

export const getInProgressAttempt = onCall({ cors: true }, quizController.getInProgressAttempt);

export const getQuizAttemptById = onCall({ cors: true }, quizController.getQuizAttemptById);

export const deleteInProgressAttempt = onCall({ cors: true }, quizController.deleteInProgressAttempt);

export const finalizeQuizAttempt = onCall({ cors: true }, quizController.finalizeQuizAttempt);

export const getQuizAnalytics = onCall({ cors: true }, quizController.getQuizAnalytics);

export const getCompletedAttemptsForQuiz = onCall({ cors: true }, quizController.getCompletedAttempts);


// ==================================================================
// 3. AUTH TRIGGERS (BACKGROUND)
// ==================================================================

// Background triggers remain V1 for syntax compatibility
export const createUserDocument = functionsV1.auth.user().onCreate(userController.onUserCreated);


// ==================================================================
// 4. PAYMENTS (STRIPE)
// ==================================================================

export const createCheckoutSession = onCall(
    { secrets: [stripeSecretKey, stripePlusPriceId, stripeProPriceId], cors: true },
    (request) => {
        const config: stripeController.StripeConfig = {
            stripe: new Stripe(stripeSecretKey.value()),
            prices: {
                plus: stripePlusPriceId.value(),
                pro: stripeProPriceId.value(),
            },
        };
        return stripeController.createCheckoutSession(request, config);
    }
);

export const stripeWebhook = onRequest(
    { secrets: [stripeSecretKey, stripeWebhookSecret, stripePlusPriceId, stripeProPriceId] },
    (req, res) => {
        const config: stripeController.StripeConfig = {
            stripe: new Stripe(stripeSecretKey.value()),
            endpointSecret: stripeWebhookSecret.value(),
            prices: {
                plus: stripePlusPriceId.value(),
                pro: stripeProPriceId.value(),
            },
        };
        // Handle as any to resolve Request/Response type conflicts with Stripe's expectations
        stripeController.handleWebhook(req as any, res as any, config);
    }
);