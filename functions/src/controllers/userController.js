// FILE: functions/src/controllers/userController.js

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

const db = admin.firestore();

// Note: This is a background trigger, not an HTTP function, 
// so it takes the 'user' object directly.
const onUserCreated = async (user) => {
  const { uid, email, displayName } = user;
  logger.info(`New user signed up: ${uid}, Email: ${email}`);
  
  const newUserRef = db.collection("users").doc(uid);
  
  try {
    await newUserRef.set({
      email: email,
      displayName: displayName || null,
      tier: "free",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeCustomerId: null,
    });
    logger.info(`Successfully created Firestore doc for user: ${uid}`);
    return null;
  } catch (error) {
    logger.error(`Error creating Firestore doc for user: ${uid}`, error);
    throw error;
  }
};

module.exports = {
  onUserCreated
};