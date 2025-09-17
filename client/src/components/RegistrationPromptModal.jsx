// FILE: client/src/components/RegistrationPromptModal.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RegistrationPromptModal.css';
import appLogo from '../assets/logo.png';

const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

function RegistrationPromptModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    if (!isOpen) {
        return null;
    }

    const handleSignUp = () => {
        navigate('/register');
    };

    const handleLogIn = () => {
        navigate('/login');
    };

    // Stop propagation to prevent clicks inside the modal from closing it.
    const handleModalContentClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div className="rpm-modal-overlay" onClick={onClose}>
            <div className="rpm-modal-container" onClick={handleModalContentClick}>
                <button onClick={onClose} className="rpm-close-button" aria-label="Close">
                    <CloseIcon />
                </button>
                
                <div className="rpm-modal-header">
                    <img src={appLogo} alt="Dental Edge Logo" className="rpm-logo" />
                    <h2 className="rpm-title">Create an account to continue</h2>
                    <p className="rpm-subtitle">
                        See how Dental Edge can help you ace the DAT. Save your progress, review detailed analytics, and unlock more content by signing up.
                    </p>
                </div>

                <div className="rpm-modal-body">
                    <button onClick={handleSignUp} className="rpm-signup-button">
                        Sign up for free
                    </button>
                    <p className="rpm-login-prompt">
                        Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); handleLogIn(); }}>Log in</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default RegistrationPromptModal;