import { CallableRequest, HttpsError, Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { db } from '../firebase';
import { UserTier } from '../types/models.types';

export interface StripeConfig {
    stripe: Stripe;
    prices: {
        plus: string;
        pro: string;
    };
    endpointSecret?: string;
}

export const createCheckoutSession = async (request: CallableRequest, config: StripeConfig): Promise<{ id: string }> => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to make a purchase.");
  }
  
  const uid = request.auth.uid;
  // Type cast request data
  const tierId = (request.data as { tierId?: string }).tierId as UserTier;
  const { stripe, prices } = config;

  if (!tierId) {
    throw new HttpsError("invalid-argument", "Missing 'tierId'.");
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }

    let priceId: string;
    if (tierId === 'plus') priceId = prices.plus;
    else if (tierId === 'pro') priceId = prices.pro;
    else throw new HttpsError("invalid-argument", `Invalid tierId: ${tierId}`);

    const liveAppUrl = "https://dental-edge.web.app"; 
    
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

  } catch (error: any) {
    logger.error(`Stripe checkout failed for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while creating the checkout session.");
  }
};

export const handleWebhook = async (request: Request, response: Response, config: StripeConfig): Promise<void> => {
  const { stripe, endpointSecret, prices } = config;
  
  if (!endpointSecret) {
      logger.error("Endpoint secret missing");
      response.status(500).send("Webhook configuration error");
      return;
  }

  const sig = request.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      sig as string,
      endpointSecret
    );
  } catch (err: any) {
    logger.error("Webhook signature verification failed.", err);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const firebaseUID = session.metadata?.firebaseUID;
    const stripeCustomerId = session.customer as string;

    if (!firebaseUID) {
        logger.warn("No firebaseUID in session metadata");
        response.status(200).send();
        return;
    }

    // Retrieve line items to determine which price was purchased
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
      session.id, { expand: ['line_items'] }
    );
    
    const priceId = sessionWithLineItems.line_items?.data[0]?.price?.id;

    let newTier: UserTier | null = null;
    if (priceId === prices.plus) newTier = "plus";
    else if (priceId === prices.pro) newTier = "pro";

    if (newTier) {
      logger.info(`Processing successful checkout for user: ${firebaseUID} -> ${newTier}`);
      await db.collection("users").doc(firebaseUID).update({ 
        tier: newTier, 
        stripeCustomerId 
      });
    }
  }

  response.status(200).send();
};