// FILE: client/src/pages/PlansPage.jsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCheck } from 'react-icons/fa';
import '../styles/PlansPage.css';

const plansData = [
  {
    tierId: 'free',
    name: 'Free',
    price: '0',
    description: 'Intelligence for everyday tasks',
    features: [
      'Access to first practice test per topic',
      'Access to first question bank per topic',
      'Limited quiz history',
    ],

  },
  {
    tierId: 'plus',
    name: 'Edge Plus',
    price: '14.99',
    description: 'More access to advanced intelligence',
    features: [
      'Everything in Free, plus:',
      'Unlimited practice tests',
      'Unlimited question banks',
      'Detailed performance analytics',
    ],
  },
  {
    tierId: 'pro',
    name: 'Edge Pro',
    price: '19.99',
    description: 'Full access to the best of Dental Edge',
    features: [
      'Everything in Plus, plus:',
      'Full-length mock exams (Coming Soon)',
      'DAT Simulator mode (Coming Soon)',
      'Priority support',
    ],
  },
];

const tierLevels = {
  free: 0,
  plus: 1,
  pro: 2,
};

function PlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  const userTier = userProfile?.tier || 'free';

  const handleClose = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(currentUser ? '/app' : '/');
    }
  };

  const getButtonState = (planTier) => {
    const planLevel = tierLevels[planTier];
    const userLevel = tierLevels[userTier];

    // --- THIS IS THE FIX ---
    // Handle the state for a user who is NOT logged in.
    if (!currentUser) {
      if (planTier === 'free') {
        return { text: 'Get Started', disabled: false, action: () => navigate('/register') };
      }
      // For other plans, the button should also lead to registration.
      const planName = plansData.find(p => p.tierId === planTier)?.name || '';
      return { text: `Get ${planName.replace('Edge ', '')}`, disabled: false, action: () => navigate('/register') };
    }
    // --- END FIX ---


    // Logic for a LOGGED-IN user remains the same.
    if (planLevel < userLevel) {
      return { text: 'Included', disabled: true, action: null };
    }
    if (planLevel === userLevel) {
      return { text: 'Your Current Plan', disabled: true, action: null };
    }
    
    // Otherwise, it's an upgrade option for a logged-in user.
    const planName = plansData.find(p => p.tierId === planTier)?.name || '';
    // The action will be to handle Stripe in the future. For now, it does nothing.
    return { text: `Get ${planName.replace('Edge ', '')}`, disabled: false, action: () => {} };
  };

  return (
    <div className="plans-page-container">
      <button onClick={handleClose} className="close-button-plans" aria-label="Close">×</button>

      <div className="plans-header">
        <h1 className="plans-title">Upgrade your plan</h1>
      </div>

      <div className="plans-grid">
        {plansData.map((plan) => {
          const buttonState = getButtonState(plan.tierId);
          const isHighlighted = 
            (userTier === 'free' && plan.tierId === 'plus') ||
            (userTier === 'plus' && plan.tierId === 'pro') ||
            (userTier === 'pro' && plan.tierId === 'pro');

          return (
            <div key={plan.tierId} className={`plan-card ${isHighlighted ? 'highlighted' : ''}`}>
              <div className="plan-card-body">
                <div className="plan-card-header">
                  <h2 className="plan-name">{plan.name}</h2>
                  <div className="plan-price">
                    <span className="price-currency">$</span>
                    <span className="price-amount">{plan.price.split('.')[0]}</span>
                    {plan.price.split('.')[1] && (
                        <span className="price-decimal">.{plan.price.split('.')[1]}</span>
                    )}
                    <span className="price-period">/ month</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                </div>

                <div className="plan-card-action">
                  <button 
                    className={`plan-button ${isHighlighted && !buttonState.disabled ? 'primary' : 'secondary'}`}
                    disabled={buttonState.disabled}
                    onClick={buttonState.action}
                  >
                    {buttonState.text}
                  </button>
                </div>

                <div className="plan-features">
                  <ul className="plan-features-list">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="feature-item">
                        <FaCheck className="feature-icon" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlansPage;