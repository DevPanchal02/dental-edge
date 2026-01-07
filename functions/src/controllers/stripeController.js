// FILE: functions/src/controllers/stripeController.js

const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Creates a checkout session.
 * @param {object} request - The callable request object.
 * @param {object} config - Contains { stripe, prices }.
 */
const createCheckoutSession = async (request, config) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to make a purchase.");
  }
  
  const uid = request.auth.uid;
  const tierId = request.data.tierId;
  const { stripe, prices } = config;

  if (!tierId) {
    throw new HttpsError("invalid-argument", "Missing 'tierId'.");
  }

  try {
    // Verify user exists
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }

    let priceId;
    if (tierId === 'plus') priceId = prices.plus;
    else if (tierId === 'pro') priceId = prices.pro;
    else throw new HttpsError("invalid-argument", `Invalid tierId: ${tierId}`);

    const liveAppUrl = "https://dental-edge-62624.web.app";
    logger.info(`Creating checkout for user: ${uid}, tier: ${tierId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      success_url: `${liveAppUrl}/app?checkout=success`,
      cancel_url: `${liveAppUrl}/plans?checkout=cancel`,
      billing_address_collection: "required",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { firebaseUID: uid },
    });

    return { id: session.id };

  } catch (error) {
    logger.error(`Stripe checkout failed for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while creating the checkout session.");
  }
};

/**
 * Handles Stripe Webhooks.
 * @param {object} request - The HTTP request.
 * @param {object} response - The HTTP response.
 * @param {object} config - Contains { stripe, endpointSecret, prices }.
 */
const handleWebhook = async (request, response, config) => {
  const { stripe, endpointSecret, prices } = config;
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      request.headers["stripe-signature"],
      endpointSecret
    );
  } catch (err) {
    logger.error("Webhook signature verification failed.", err);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const firebaseUID = session.metadata.firebaseUID;
    const stripeCustomerId = session.customer;

    // Retrieve line items to verify which price was bought
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
      session.id, { expand: ['line_items'] }
    );
    const priceId = sessionWithLineItems.line_items.data[0].price.id;

    let newTier = null;
    if (priceId === prices.plus) newTier = "plus";
    else if (priceId === prices.pro) newTier = "pro";

    if (firebaseUID && newTier) {
      logger.info(`Processing successful checkout for user: ${firebaseUID} -> ${newTier}`);
      await db.collection("users").doc(firebaseUID).update({ 
        tier: newTier, 
        stripeCustomerId 
      });
    }
  }

  response.status(200).send();
};

module.exports = {
  createCheckoutSession,
  handleWebhook
};