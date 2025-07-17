import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase';

// Create the context with a default value.
const AuthContext = createContext();

/**
 * Custom hook to use the AuthContext.
 * This makes it easier to access the context from any component.
 * @returns {object} The authentication context value.
 */
export const useAuth = () => {
  return useContext(AuthContext);
};

/**
 * The AuthProvider component wraps the application and provides the auth context.
 * It manages the user state and provides authentication functions.
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Signs up a new user with email and password.
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns {Promise<UserCredential>}
   */
  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  /**
   * Logs in a user with email and password.
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns {Promise<UserCredential>}
   */
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Logs out the current user.
   * @returns {Promise<void>}
   */
  const logout = () => {
    return signOut(auth);
  };

  /**
   * Signs in a user with their Google account via a popup.
   * @returns {Promise<UserCredential>}
   */
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  // This effect hook sets up a listener to Firebase's authentication state.
  // It runs only once when the component mounts.
  useEffect(() => {
    // onAuthStateChanged returns an 'unsubscribe' function.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false); // Set loading to false once we have a user or know there isn't one.
    });

    // The returned function will be called on component unmount,
    // which cleans up the listener and prevents memory leaks.
    return unsubscribe;
  }, []); // The empty dependency array ensures this effect runs only once.

  // The value provided to the context consumers.
  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    signInWithGoogle,
  };

  // Render the children components, but only when not loading to prevent
  // rendering parts of the app in a weird intermediate state.
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};