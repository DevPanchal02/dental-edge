export type UserTier = 'free' | 'plus' | 'pro';

/**
 * Represents the public profile stored in Firestore (users/{uid}).
 */
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    tier: UserTier;
    stripeCustomerId?: string | null;
    createdAt?: Date; // Firestore timestamps converted to Dates
}

/**
 * Represents the authenticated state in the AuthContext.
 */
export interface AuthState {
    currentUser: UserProfile | null; // The enriched user object
    firebaseUser: object | null;     // The raw Firebase Auth object (if needed)
    loading: boolean;
    error: Error | null;
}