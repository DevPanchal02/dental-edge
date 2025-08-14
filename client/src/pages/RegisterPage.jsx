import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/userLogin.css";
import registerImage from "../assets/registerImage.jpg";
import googleLogo from "../assets/google-logo.svg";
import { useAuth } from "../context/AuthContext"; 
import { updateProfile, sendEmailVerification } from "firebase/auth"; 
import { auth } from "../firebase"; 

function RegisterPage() {
  // State remains the same
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Get the signup and signInWithGoogle functions from our context
  const { signup, signInWithGoogle } = useAuth();

  const handleSignup = async (event) => {
    event.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true);

    try {
      const userCredential = await signup(email, password);
      // After signup, update the profile and send verification email
      await updateProfile(userCredential.user, { displayName: username });
      await sendEmailVerification(userCredential.user);
      
      // Navigate to the login page with a state message to inform the user
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
      navigate("/"); // On successful Google sign-in, go to the main app
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="image-container">
        <img src={registerImage} alt="Dental assisting tools" className="background-image" />
      </div>
      <div className="login-form">
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