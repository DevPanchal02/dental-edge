// FILE: client/src/pages/PlansPage.jsx

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCheck } from 'react-icons/fa';
import '../styles/PlansPage.css';

// --- NEW IMPORTS ---
import { loadStripe } from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/api';

// --- NEW: Load Stripe with your publishable key from the .env file ---
// This must be outside the component to avoid being reloaded on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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

  // --- NEW: State to handle loading and errors ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(currentUser ? '/app' : '/');
    }
  };

  // --- NEW: This function handles the entire checkout process ---
  const handleCheckout = async (planTierId) => {
    // For now, we only allow purchasing the 'plus' plan
    if (planTierId !== 'plus') {
        alert("Only the Edge Plus plan is available for purchase at this time.");
        return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      // 1. Call our backend to create a checkout session
      const sessionId = await createCheckoutSession();

      // 2. Get an instance of Stripe.js
      const stripe = await stripePromise;

      // 3. Redirect the user to Stripe's hosted checkout page
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        // This error is usually a client-side issue (e.g., network error)
        console.error("Stripe redirection error:", error);
        setError("Could not redirect to payment page. Please try again.");
      }
    } catch (err) {
      // This error comes from our backend function failing
      console.error("Backend checkout error:", err);
      setError("An error occurred on our server. Please try again later.");
    } finally {
      // This part might not be reached if redirection is successful,
      // but it's good practice for handling errors.
      setIsLoading(false);
    }
  };


  const getButtonState = (planTier) => {
    const planLevel = tierLevels[planTier];
    const userLevel = tierLevels[userTier];

    // Handle the state for a user who is NOT logged in.
    if (!currentUser) {
      if (planTier === 'free') {
        return { text: 'Get Started', disabled: isLoading, action: () => navigate('/register') };
      }
      const planName = plansData.find(p => p.tierId === planTier)?.name || '';
      return { text: `Get ${planName.replace('Edge ', '')}`, disabled: isLoading, action: () => navigate('/register') };
    }

    // Logic for a LOGGED-IN user
    if (planLevel < userLevel) {
      return { text: 'Included', disabled: true, action: null };
    }
    if (planLevel === userLevel) {
      return { text: 'Your Current Plan', disabled: true, action: null };
    }
    
    // Otherwise, it's an upgrade option for a logged-in user.
    const planName = plansData.find(p => p.tierId === planTier)?.name || '';
    
    // --- UPDATE: The action now calls our new handleCheckout function ---
    return { 
        text: isLoading ? 'Processing...' : `Get ${planName.replace('Edge ', '')}`, 
        disabled: isLoading, 
        action: () => handleCheckout(planTier) 
    };
  };

  return (
    <div className="plans-page-container">
      <button onClick={handleClose} className="close-button-plans" aria-label="Close">×</button>

      <div className="plans-header">
        <h1 className="plans-title">Upgrade your plan</h1>
        {/* --- NEW: Display error messages --- */}
        {error && <p className="plans-error-message">{error}</p>}
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