import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import TopicPage from './pages/TopicPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import { fetchTopics } from './services/loader.js';

function App() {
  const [firstTopicId, setFirstTopicId] = useState(null);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const getFirstTopic = async () => {
      setLoadingTopics(true);
      try {
        const topics = await fetchTopics();
        if (topics && topics.length > 0) {
          setFirstTopicId(topics[0].id);
        } else {
          setFirstTopicId('no-topics');
          setFetchError("No topics found from the backend API.");
        }
      } catch (error) {
        console.error("Error fetching initial topics in App.jsx:", error);
        setFirstTopicId('no-topics');
        setFetchError("Error loading topics.");
      } finally {
        setLoadingTopics(false);
      }
    };
    getFirstTopic();
  }, []);

  if (loadingTopics) {
    return <div className="page-loading">Initializing...</div>;
  }

  const initialRedirectPath = firstTopicId ? `/topic/${firstTopicId}` : '/topic/no-topics';

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to={initialRedirectPath} replace />} />
        <Route path="topic/:topicId" element={<TopicPage />} />
        <Route
            path="quiz/:topicId/:sectionType/:quizId"
            element={<QuizPage key={location.pathname} />}
        />
        <Route path="results/:topicId/:sectionType/:quizId" element={<ResultsPage />} />
        <Route path="/topic/no-topics" element={<div className="page-info">No topics found. Check backend function logs.</div>} />
      </Route>
    </Routes>
  );
}

export default App;