import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/ContactPage.css';

/**
 * Renders the contact page with a form for user inquiries.
 */
function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Thank you, ${formData.name}. Your message has been sent.`);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="contact-page-container">
      <Link to="/" className="close-button-contact" aria-label="Close">×</Link>
      
      {/* Wrapper to control the left-aligned content */}
      <div className="contact-content-wrapper">
        <div className="contact-header">
          <h1 className="contact-title">We're here to help!</h1>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. John Smith"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. example@gmail.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="message" className="form-label">Message</label>
            <textarea
              id="message"
              name="message"
              className="form-textarea"
              rows="6"
              value={formData.message}
              onChange={handleChange}
              placeholder="Let us know how we can help"
              required
            ></textarea>
          </div>
          <div className="form-footer">
            <button type="submit" className="submit-button">Send message</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactPage;