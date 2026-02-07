import { db } from '../firebase';
import * as logger from 'firebase-functions/logger';
import { FieldValue } from 'firebase-admin/firestore';
import { UserRecord } from 'firebase-admin/auth';

// Note: This is a background trigger, not an HTTP function.
export const onUserCreated = async (user: UserRecord): Promise<null> => {
    const { uid, email, displayName } = user;
    logger.info(`New user signed up: ${uid}, Email: ${email}`);

    const newUserRef = db.collection("users").doc(uid);

    try {
        await newUserRef.set({
            email: email,
            displayName: displayName || null,
            tier: "free",
            createdAt: FieldValue.serverTimestamp(),
            stripeCustomerId: null,
        });
        logger.info(`Successfully created Firestore doc for user: ${uid}`);
        return null;
    } catch (error) {
        logger.error(`Error creating Firestore doc for user: ${uid}`, error);
        throw error;
    }
};