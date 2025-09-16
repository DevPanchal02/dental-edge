import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/PlansPage.css';

/**
 * Renders the subscription plans page.
 * Users can view different tiers and choose a plan.
 */
function PlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const handleClose = () => {
    // If there is a page in the history, go back to it
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      // Otherwise, go to a sensible fallback page
      navigate(currentUser ? '/app' : '/');
    }
  };

  return (
    <div className="plans-page-container">
      <button onClick={handleClose} className="close-button-plans" aria-label="Close">×</button>

      <div className="plans-header">
        <h1 className="plans-title">Upgrade your plan</h1>
      </div>

      <div className="plans-grid">
        {/* Free Plan */}
        <div className="plan-card">
          <div className="plan-card-header">
            <h2 className="plan-name">Free</h2>
            <p className="plan-price">
              <span className="price-currency">$</span>
              <span className="price-amount">0</span>
              <span className="price-period">/ month</span>
            </p>
            <p className="plan-description">Intelligence for everyday tasks</p>
          </div>
          <div className="plan-card-footer">
            <button className="plan-button secondary" disabled>Your current plan</button>
          </div>
        </div>

        {/* Edge Plus Plan (Highlighted) */}
        <div className="plan-card highlighted">
          <div className="plan-card-header">
            <h2 className="plan-name">Edge Plus</h2>
            <p className="plan-price">
              <span className="price-currency">$</span>
              <span className="price-amount">14.99</span>
              <span className="price-period">/ month</span>
            </p>
            <p className="plan-description">More access to advanced intelligence</p>
          </div>
          <div className="plan-card-footer">
            <button className="plan-button primary">Get Plus</button>
          </div>
        </div>

        {/* Edge Pro Plan */}
        <div className="plan-card">
          <div className="plan-card-header">
            <h2 className="plan-name">Edge Pro</h2>
            <p className="plan-price">
              <span className="price-currency">$</span>
              <span className="price-amount">19.99</span>
              <span className="price-period">/ month</span>
            </p>
            <p className="plan-description">Full access to the best of Dental Edge</p>
          </div>
          <div className="plan-card-footer">
            <button className="plan-button secondary">Get Pro</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlansPage;