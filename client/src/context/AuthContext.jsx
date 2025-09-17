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

  // --- MODIFICATION: We now track the full user profile from Firestore ---
  const [userProfile, setUserProfile] = useState(null);

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    setUserProfile(null); // Clear the profile on logout
    return signOut(auth);
  };

  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  // This effect hook now manages both Auth state and Firestore profile state.
  useEffect(() => {
    let unsubscribeFromProfile = () => {};

    const unsubscribeFromAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // If a user logs in, listen for their profile changes in real-time.
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        
        // onSnapshot creates a real-time listener.
        unsubscribeFromProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile({ uid: user.uid, ...docSnap.data() });
          } else {
            // This might happen briefly if the createUserDocument function is slow.
            console.warn("User document not yet available in Firestore.");
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
            console.error("Error listening to user profile:", error);
            setUserProfile(null);
            setLoading(false);
        });

      } else {
        // If no user is logged in, clear everything.
        unsubscribeFromProfile();
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeFromAuth();
      unsubscribeFromProfile();
    };
  }, []);

  // --- MODIFICATION: The provided value now includes the userProfile ---
  const value = {
    currentUser, // This is the standard Firebase auth object
    userProfile, // This is our rich profile object from Firestore with the tier
    loading,
    signup,
    login,
    logout,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
