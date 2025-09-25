// FILE: client/src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    setUserProfile(null);
    return signOut(auth);
  };

  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  useEffect(() => {
    let unsubscribeFromProfile = () => {};

    const unsubscribeFromAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // --- THIS IS THE FIX ---
      // When auth state changes, immediately reset the profile and enter a loading state.
      setUserProfile(null);
      setLoading(true);

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        
        unsubscribeFromProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile({ uid: user.uid, ...docSnap.data() });
          } else {
            // This case handles the brief delay for new signups. We'll keep
            // the profile as null, and our UI will wait.
            console.warn("User document not yet available in Firestore for new user.");
          }
          // We only set loading to false AFTER we've received the first snapshot.
          setLoading(false);
        }, (error) => {
            console.error("Error listening to user profile:", error);
            setUserProfile(null);
            setLoading(false);
        });

      } else {
        // No user, so we are done loading.
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFromAuth();
      unsubscribeFromProfile();
    };
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading, // This `loading` state is now more accurate.
    signup,
    login,
    logout,
    signInWithGoogle,
  };

  // We now render children ONLY when loading is false, preventing the UI flicker.
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
