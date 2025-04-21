// FILE: client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'; // Added useLocation
import Layout from './components/Layout';
import TopicPage from './pages/TopicPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage'; // Import the new ResultsPage
import { fetchTopics } from './data/loader';

function App() {
  const [firstTopicId, setFirstTopicId] = useState(null);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const location = useLocation(); // Get location for key prop

  useEffect(() => {
    const getFirstTopic = async () => {
      setLoadingTopics(true); // Ensure loading state is set
      try {
        const topics = await fetchTopics();
        if (topics && topics.length > 0) {
          setFirstTopicId(topics[0].id);
        } else {
          setFirstTopicId('no-topics');
          setFetchError("No topics found in data/loader.js");
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
  }, []); // Empty dependency array ensures this runs only once

  if (loadingTopics) {
    return <div className="page-loading">Initializing...</div>;
  }

  // Use the determined firstTopicId for the initial redirect
  const initialRedirectPath = firstTopicId ? `/topic/${firstTopicId}` : '/topic/no-topics';

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to={initialRedirectPath} replace />} />
        <Route path="topic/:topicId" element={<TopicPage />} />
        {/* Add key to QuizPage to force remount/reset state when navigating between quizzes */}
        <Route
            path="quiz/:topicId/:sectionType/:quizId"
            element={<QuizPage key={location.pathname} />} // Use location.pathname as key
        />
        {/* Add Route for Results Page */}
        <Route path="results/:topicId/:sectionType/:quizId" element={<ResultsPage />} />
        <Route path="/topic/no-topics" element={<div className="page-info">No topics found. Check data folder structure and loader.js logs.</div>} />
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Route>
    </Routes>
  );
}

export default App;