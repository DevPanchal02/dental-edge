import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import "../styles/userLogin.css";
import loginImage from "../assets/login.jpg";
import googleLogo from "../assets/google-logo.svg";
import appLogo from "../assets/logo.png"; // Import the logo
import { useAuth } from "../context/AuthContext"; 

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { login, signInWithGoogle, currentUser } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect them to the app.
    if (currentUser) {
      navigate("/app", { replace: true });
    }
  }, [currentUser, navigate]);

  const registrationMessage = location.state?.message;

  const handleSignIn = async (event) => {
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
      // Navigation is now handled by the useEffect hook reacting to currentUser change.
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
    // No need to set loading to false here, as the redirect will happen.
  };

  const handleGoogleSignIn = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      // Navigation is handled by the useEffect hook.
    } catch (err) {
      setError(err.message);
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
          {error && <p className="error-message">{error.replace('Firebase: ', '')}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;