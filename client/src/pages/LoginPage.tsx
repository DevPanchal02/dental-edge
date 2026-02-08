import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import "../styles/userLogin.css";
import loginImage from "../assets/login.jpg";
import googleLogo from "../assets/google-logo.svg";
import appLogo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/error.utils";

interface LocationState {
  message?: string;
}

function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signInWithGoogle, currentUser } = useAuth();

  // Safely cast location.state
  const state = location.state as LocationState | null;
  const registrationMessage = state?.message;

  useEffect(() => {
    // If the user is already logged in, redirect them to the app.
    if (currentUser) {
      navigate("/app", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const userCredential = await login(email, password);
      if (!userCredential.user.emailVerified) {
        setError("Please verify your email address before logging in.");
        setLoading(false);
        return;
      }
      // Navigation is handled by the useEffect hook reacting to currentUser change.
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to sign in.");
      setError(msg);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (event: React.MouseEvent) => {
    event.preventDefault(); 
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      // Navigation is handled by the useEffect hook.
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to sign in with Google.");
      setError(msg);
      setLoading(false);
    }
  };

  // Render nothing while checking for currentUser to avoid flashing the form.
  if (currentUser) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="image-container">
        <img src={loginImage} alt="Dental tools on a tray" className="background-image" />
      </div>
      <div className="login-form">
        <Link to="/" className="auth-logo-back-button" title="Back to Home" aria-label="Back to Home">
          <img src={appLogo} alt="Dental Edge Logo" />
        </Link>
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
          {/* UI is now dumb: it just displays the string given to it */}
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;