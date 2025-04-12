import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PracticeTests from '../components/PracticeTests';
import '../styles/HomePage.css';

// --- Configuration ---
// !! REPLACE WITH YOUR ACTUAL BACKEND API BASE URL !!
const API_BASE_URL = '/api';
const TOPICS_ENDPOINT = `${API_BASE_URL}/topics`;
const getTestsEndpoint = (topicId) => `${API_BASE_URL}/topics/${topicId}/tests`;
// --- End Configuration ---

function HomePage() {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isTopicsLoading, setIsTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState(null);

  const [tests, setTests] = useState([]);
  const [isTestsLoading, setIsTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState(null);

  // Fetch topics on initial mount
  useEffect(() => {
    const loadTopics = async () => {
      setIsTopicsLoading(true);
      setTopicsError(null);
      try {
        // const response = await axios.get(TOPICS_ENDPOINT); // << AXIOS CALL COMMENTED OUT
        // const fetchedTopics = response.data || []; // << ACTUAL DATA HANDLING COMMENTED OUT
        const fetchedTopics = []; // Placeholder

        setTopics(fetchedTopics);
        if (fetchedTopics.length > 0) {
          setSelectedTopic(fetchedTopics[0]);
        } else {
          setSelectedTopic(null);
           if (!fetchedTopics || fetchedTopics.length === 0) {
               setTopicsError("No topics found. (Backend fetch is currently disabled).")
           }
        }
      } catch (error) {
        console.error("API Error fetching topics:", error);
        setTopicsError("Failed to fetch topics. Backend might be unavailable or fetch is disabled.");
      } finally {
        setIsTopicsLoading(false);
      }
    };
    loadTopics();
  }, []);

  // Fetch tests when selectedTopic changes
  useEffect(() => {
    if (!selectedTopic?.id) {
       setTests([]);
       setTestsError(null);
       return;
    }
    const loadTests = async () => {
      setIsTestsLoading(true);
      setTestsError(null);
      setTests([]);
      const testsEndpoint = getTestsEndpoint(selectedTopic.id);
      try {
        // const response = await axios.get(testsEndpoint); // << AXIOS CALL COMMENTED OUT
        // const fetchedTests = response.data || []; // << ACTUAL DATA HANDLING COMMENTED OUT
        const fetchedTests = []; // Placeholder

        setTests(fetchedTests);
      } catch (error) {
        console.error(`API Error fetching tests for topic ${selectedTopic.id}:`, error);
        setTestsError(`Failed to fetch tests for ${selectedTopic.name}. Backend might be unavailable or fetch is disabled.`);
      } finally {
        setIsTestsLoading(false);
      }
    };
    loadTests();
  }, [selectedTopic]);

  const handleTopicSelect = (topic) => {
    if (topic?.id !== selectedTopic?.id) {
        setSelectedTopic(topic);
    }
  };

  if (isTopicsLoading) {
    return <div className="page-loading">Loading Topics...</div>;
  }

  if (topicsError && topics.length === 0) {
    return <div className="page-error">Error: {topicsError}</div>;
  }

   if (topics.length === 0 && !topicsError) {
     return <div className="page-info">No topics available.</div>;
   }

  return (
    <div className="home-page-layout">
      <Sidebar
        topics={topics}
        selectedTopic={selectedTopic}
        onTopicSelect={handleTopicSelect}
      />
      <main className="home-page-main-content">
        {selectedTopic ? (
          <PracticeTests
            topic={selectedTopic}
            tests={tests}
            isLoading={isTestsLoading}
            error={testsError}
          />
        ) : (
          !isTopicsLoading && <div className="page-info">Please select a topic from the sidebar.</div>
        )}
      </main>
    </div>
  );
}

export default HomePage;