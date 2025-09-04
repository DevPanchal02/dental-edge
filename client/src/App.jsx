import React, { useState, useEffect } from 'react';
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
import { fetchTopics } from './services/loader.js';
import { useAuth } from './context/AuthContext'; 

function App() {
  const [firstTopicId, setFirstTopicId] = useState(null);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const location = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    const getFirstTopic = async () => {
      setLoadingTopics(true);
      try {
        const topics = await fetchTopics();
        if (topics && topics.length > 0) {
          setFirstTopicId(topics[0].id);
        }
      } catch (error) {
        console.error("Error fetching initial topics in App.jsx:", error);
        setFirstTopicId('no-topics');
      } finally {
        setLoadingTopics(false);
      }
    };
    if (currentUser) {
      getFirstTopic();
    } else {
      setLoadingTopics(false);
    }
  }, [currentUser]);

  if (loadingTopics) {
    return <div className="page-loading">Initializing Application...</div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      
      {/* Add route to the plans page, accessible when logged in */}
      <Route path="/plans" element={currentUser ? <PlansPage /> : <Navigate to="/login" />} />

      {/* Protected Routes */}
      <Route path="/app" element={currentUser ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={firstTopicId ? <Navigate to={`/app/topic/${firstTopicId}`} replace /> : <div>Loading...</div>} />
        <Route path="topic/:topicId" element={<TopicPage />} />
        <Route
            path="quiz/:topicId/:sectionType/:quizId"
            element={<QuizPage key={location.pathname} />}
        />
        <Route path="results/:topicId/:sectionType/:quizId" element={<ResultsPage />} />
        <Route path="topic/no-topics" element={<div className="page-info">No topics found. Check backend function logs.</div>} />
      </Route>
    </Routes>
  );
}

export default App;