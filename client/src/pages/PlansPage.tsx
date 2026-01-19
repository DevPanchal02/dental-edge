import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCheck } from 'react-icons/fa';
import '../styles/PlansPage.css';
import { loadStripe} from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/api';
import { UserTier } from '../types/user.types';

// Strict check for environment variable to prevent silent failures in production
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!STRIPE_KEY) {
    console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY in environment variables.");
}

// Initialize Stripe outside component to avoid re-initialization on render
const stripePromise = loadStripe(STRIPE_KEY);

interface Plan {
    tierId: UserTier;
    name: string;
    price: string;
    description: string;
    features: string[];
}

const plansData: Plan[] = [
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
    description: 'The ultimate DAT toolkit for top performers.',
    features: [
      'All features from Edge Plus, plus:',
      'Full-length mock exams (Coming Soon)',
      'DAT Simulator mode (Coming Soon)',
      'Priority support',
    ],
  },
];

// Record<UserTier, number> ensures we handle every tier defined in our types
const tierLevels: Record<UserTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

function PlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  
  // Default to 'free' if profile hasn't loaded yet, though AuthContext usually handles this
  const userTier: UserTier = userProfile?.tier || 'free';

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleClose = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(currentUser ? '/app' : '/');
    }
  };

  const handleCheckout = async (tierId: UserTier) => {
    if (tierId !== 'plus' && tierId !== 'pro') {
        alert("This plan is not available for purchase at this time.");
        return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      // 1. Create Session on Backend
      const sessionId = await createCheckoutSession(tierId);
      
      // 2. Load Stripe Instance
      const stripe = await stripePromise;
      if (!stripe) {
          throw new Error("Stripe failed to initialize.");
      }

      // 3. Redirect to Checkout
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        console.error("Stripe redirection error:", result.error);
        setError(result.error.message || "Could not redirect to payment page.");
      }
    } catch (err: any) {
      console.error("Backend checkout error:", err);
      setError(err.message || "An error occurred on our server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  interface ButtonState {
      text: string;
      disabled: boolean;
      action: (() => void) | null;
  }

  const getButtonState = (plan: Plan): ButtonState => {
    const planLevel = tierLevels[plan.tierId];
    const userLevel = tierLevels[userTier];

    // Logic for a user who is NOT logged in.
    if (!currentUser) {
      if (plan.tierId === 'free') {
        return { text: 'Get Started', disabled: isLoading, action: () => navigate('/register') };
      }
      return { text: `Get ${plan.name.replace('Edge ', '')}`, disabled: isLoading, action: () => navigate('/register') };
    }

    // Logic for a LOGGED-IN user.
    if (planLevel < userLevel) {
      return { text: 'Included', disabled: true, action: null };
    }
    if (planLevel === userLevel) {
      return { text: 'Your Current Plan', disabled: true, action: null };
    }
    
    // Upgrade path
    return { 
        text: isLoading ? 'Processing...' : `Get ${plan.name.replace('Edge ', '')}`, 
        disabled: isLoading, 
        action: () => handleCheckout(plan.tierId) 
    };
  };

  return (
    <div className="plans-page-container">
      <button onClick={handleClose} className="close-button-plans" aria-label="Close">×</button>

      <div className="plans-header">
        <h1 className="plans-title">Upgrade your plan</h1>
        {error && <p className="plans-error-message">{error}</p>}
      </div>

      <div className="plans-grid">
        {plansData.map((plan) => {
          const buttonState = getButtonState(plan);
          const isHighlighted = 
            (userTier === 'free' && plan.tierId === 'plus') ||
            (userTier === 'plus' && plan.tierId === 'pro') ||
            (userTier === 'pro' && plan.tierId === 'pro');
          
          const priceParts = plan.price.split('.');
          const priceMain = priceParts[0];
          const priceDecimal = priceParts[1] || '';

          return (
            <div key={plan.tierId} className={`plan-card ${isHighlighted ? 'highlighted' : ''}`}>
              <div className="plan-card-body">
                <div className="plan-card-header">
                  <h2 className="plan-name">{plan.name}</h2>
                  <div className="plan-price">
                    <span className="price-currency">$</span>
                    <span className="price-amount">{priceMain}</span>
                    {priceDecimal && (
                        <span className="price-decimal">.{priceDecimal}</span>
                    )}
                    <span className="price-period">/ month</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                </div>

                <div className="plan-card-action">
                  <button 
                    className={`plan-button ${isHighlighted && !buttonState.disabled ? 'primary' : 'secondary'}`}
                    disabled={buttonState.disabled}
                    // Only attach onClick if action exists
                    onClick={buttonState.action ? buttonState.action : undefined}
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