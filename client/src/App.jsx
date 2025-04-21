// FILE: client/src/App.jsx
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TopicPage from './pages/TopicPage';
import QuizPage from './pages/QuizPage';

// Import the function to fetch topics, NOT the raw data object
import { fetchTopics } from './data/loader';

function App() {
  // Use state to store the first topic ID once fetched
  const [firstTopicId, setFirstTopicId] = useState(null);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    // Fetch topics when the App component mounts
    const getFirstTopic = async () => {
      try {
        const topics = await fetchTopics();
        if (topics && topics.length > 0) {
          setFirstTopicId(topics[0].id); // Get the ID of the first topic
        } else {
          setFirstTopicId('no-topics'); // Set placeholder if no topics found
          setFetchError("No topics found in data/loader.js");
        }
      } catch (error) {
        console.error("Error fetching initial topics in App.jsx:", error);
        setFirstTopicId('no-topics'); // Set placeholder on error
        setFetchError("Error loading topics.");
      } finally {
        setLoadingTopics(false);
      }
    };
    getFirstTopic();
  }, []); // Empty dependency array ensures this runs only once

  // Show loading state while fetching the first topic ID
  if (loadingTopics) {
    // You might want a more sophisticated loading screen here
    return <div className="page-loading">Initializing...</div>;
  }

  // Handle potential errors during initial topic fetch
  // if (fetchError) {
  //    return <div className="page-error">{fetchError}</div>;
 // }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Redirect base path dynamically based on fetched firstTopicId */}
        <Route index element={<Navigate to={`/topic/${firstTopicId}`} replace />} />
        {/* Route for selecting tests/banks within a topic */}
        <Route path="topic/:topicId" element={<TopicPage />} />
        {/* Route for taking a quiz */}
        {/* sectionType can be 'practice' or 'qbank' */}
        <Route path="quiz/:topicId/:sectionType/:quizId" element={<QuizPage />} />
        {/* Optional: Add a 404 page or handle 'no-topics' */}
        <Route path="/topic/no-topics" element={<div className="page-info">No topics found in the data directory. Please check the structure and file names.</div>} />
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Route>
    </Routes>
  );
}

export default App;