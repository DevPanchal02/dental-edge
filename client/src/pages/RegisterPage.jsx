import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/userLogin.css";
import registerImage from "../assets/registerImage.jpg";
import googleLogo from "../assets/google-logo.svg";
import appLogo from "../assets/logo.png"; // Import the logo
import { useAuth } from "../context/AuthContext"; 
import { updateProfile, sendEmailVerification } from "firebase/auth"; 

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { signup, signInWithGoogle, currentUser } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect them to the app.
    if (currentUser) {
      navigate("/app", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signup(email, password);
      await updateProfile(userCredential.user, { displayName: username });
      await sendEmailVerification(userCredential.user);
      
      navigate("/login", {
        state: { message: "Registration successful! Please check your email to verify your account before logging in." }
      });

    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogleSignUp = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      // Navigation is now handled by the useEffect hook.
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Render nothing while checking for currentUser.
  if (currentUser) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="image-container">
        <img src={registerImage} alt="Dental assisting tools" className="background-image" />
      </div>
      <div className="login-form">
        <Link to="/" className="auth-logo-back-button" title="Back to Home" aria-label="Back to Home">
          <img src={appLogo} alt="Dental Edge Logo" />
        </Link>
        <h1 className="welcome-back">Create an Account</h1>
        <form onSubmit={handleSignup} className="login-form-container">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            required
          />
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
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
          />
          <button type="submit" className="sign-in-button" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
          <div className="separator"></div>
          <button onClick={handleGoogleSignUp} className="google-button" type="button" disabled={loading}>
            <img src={googleLogo} alt="Google Logo" />
            Login with Google
          </button>
          <div className="signup-link">
            <p>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
          {error && <p className="error-message">{error.replace('Firebase: ', '')}</p>}
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;