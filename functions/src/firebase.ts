import * as admin from 'firebase-admin';

// Check if app is already initialized to prevent "App already exists" errors during reload
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export const auth = admin.auth();