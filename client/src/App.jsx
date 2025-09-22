// FILE: client/src/App.jsx

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import TopicPage from './pages/TopicPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import PlansPage from './pages/PlansPage';
import ContactPage from './pages/ContactPage.jsx';
// We no longer need fetchTopics here
import { useAuth } from './context/AuthContext'; 

function App() {
  const location = useLocation();
  const { currentUser, loading } = useAuth();

  // --- THIS IS THE FIX ---
  // We no longer need to fetch topics here. We will redirect to a default
  // topic, and the Layout component will handle fetching the data.
  // This avoids the "cold start storm" by separating navigation from data loading.
  
  // Show a loading screen while Firebase Auth is initializing
  if (loading) {
    return <div className="page-loading">Initializing Application...</div>;
  }

  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/plans" element={<PlansPage />} />

      <Route
        path="/preview/quiz/:topicId/:sectionType/:quizId"
        element={<QuizPage key={location.pathname} isPreviewMode={true} />}
      />

      {/* --- Protected Application Routes --- */}
      <Route path="/app" element={currentUser ? <Layout /> : <Navigate to="/login" />}>
        {/*
          Redirect to the first known topic by default. The Layout will handle
          the actual data fetching. If 'biology' doesn't exist, the user
          will still see the sidebar and can choose another topic.
        */}
        <Route index element={<Navigate to="/app/topic/biology" replace />} />
        <Route path="topic/:topicId" element={<TopicPage />} />
        <Route
            path="quiz/:topicId/:sectionType/:quizId"
            element={<QuizPage key={location.pathname} />}
        />
        <Route path="results/:topicId/:sectionType/:quizId" element={<ResultsPage />} />
      </Route>
    </Routes>
  );
}

export default App;