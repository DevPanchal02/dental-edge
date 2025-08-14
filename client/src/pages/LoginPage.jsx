import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import "../styles/userLogin.css";
import loginImage from "../assets/login.jpg";
import googleLogo from "../assets/google-logo.svg";
import { useAuth } from "../context/AuthContext"; 

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // Hook to get state passed from navigation

  // Get the login functions from our context
  const { login, signInWithGoogle } = useAuth();

  // Display the message from the registration page if it exists
  const registrationMessage = location.state?.message;

  const handleSignIn = async (event) => {
    event.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true);
    
    try {
      const userCredential = await login(email, password);
      if (!userCredential.user.emailVerified) {
        setError("Please verify your email address before logging in.");
        // We don't need to sign out; the user is still in a "limbo" state.
        setLoading(false);
        return;
      }
      // On successful login, AuthProvider's onAuthStateChanged will update the
      // global state. We just need to navigate to the main app.
      navigate("/");

    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate("/"); // On successful Google sign-in, go to the main app
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="image-container">
        <img src={loginImage} alt="Dental tools on a tray" className="background-image" />
      </div>
      <div className="login-form">
        <h1 className="welcome-back">Welcome back</h1>
        {registrationMessage && <p className="verification-message">{registrationMessage}</p>}
        <form onSubmit={handleSignIn} className="login-form-container">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
          />
          <button type="submit" className="sign-in-button" disabled={loading}>
            {loading ? "Signing In..." : "Sign-In"}
          </button>
          <div className="separator"> </div>
          <button onClick={handleGoogleSignIn} className="google-button" type="button" disabled={loading}>
            <img src={googleLogo} alt="Google Logo" />
            Log in with Google
          </button>
          <div className="signup-link">
            <p>
              Don't have an account? <Link to="/register">Sign up for free</Link>
            </p>
          </div>
          {error && <p className="error-message">{error.replace('Firebase: ', '')}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;