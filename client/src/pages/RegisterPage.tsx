import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/userLogin.css";
import registerImage from "../assets/registerImage.jpg";
import googleLogo from "../assets/google-logo.svg";
import appLogo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext"; 
import { updateProfile, sendEmailVerification } from "firebase/auth"; 

function RegisterPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  const navigate = useNavigate();
  const { signup, signInWithGoogle, currentUser } = useAuth();

  useEffect(() => {
    // If the user is already logged in, redirect them to the app.
    if (currentUser) {
      navigate("/app", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signup(email, password);
      
      // Update the user's display name immediately after creation
      await updateProfile(userCredential.user, { displayName: username });
      await sendEmailVerification(userCredential.user);
      
      // Navigate to login with a success message in state
      navigate("/login", {
        state: { message: "Registration successful! Please check your email to verify your account before logging in." }
      });

    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create account.";
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleGoogleSignUp = async (event: React.MouseEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      // Navigation is now handled by the useEffect hook.
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to sign up with Google.";
      setError(errorMessage);
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