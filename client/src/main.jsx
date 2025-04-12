import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Global CSS is imported in App.jsx or here, ensure it's imported once.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);