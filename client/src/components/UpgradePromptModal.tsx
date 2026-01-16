import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/UpgradePromptModal.css';
import { FaLock, FaCheckCircle } from 'react-icons/fa';

interface UpgradePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    if (!isOpen) {
        return null;
    }

    const handleViewPlans = () => {
        navigate('/plans');
    };

    // Stop propagation to prevent clicks inside the modal from closing it.
    const handleModalContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    return (
        <div className="upm-modal-overlay" onClick={onClose}>
            <div className="upm-modal-container" onClick={handleModalContentClick}>
                <button onClick={onClose} className="upm-close-button" aria-label="Close">
                    <CloseIcon />
                </button>
                
                <div className="upm-modal-header">
                    <div className="upm-icon-container">
                        <FaLock />
                    </div>
                    <h2 className="upm-title">Upgrade to Edge Plus</h2>
                    <p className="upm-subtitle">
                        Unlock this content and get full access to our entire study suite.
                    </p>
                </div>

                <div className="upm-modal-body">
                    <ul className="upm-features-list">
                        <li><FaCheckCircle className="upm-feature-icon" /> Access all Practice Tests</li>
                        <li><FaCheckCircle className="upm-feature-icon" /> Access all Question Banks</li>
                        <li><FaCheckCircle className="upm-feature-icon" /> Detailed Performance Analytics</li>
                        <li><FaCheckCircle className="upm-feature-icon" /> Unlimited Quiz History</li>
                    </ul>
                </div>

                <div className="upm-modal-footer">
                     <button onClick={handleViewPlans} className="upm-upgrade-button">
                        View Plans
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradePromptModal;