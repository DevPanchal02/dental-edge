// FILE: client/src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import { fetchTopics } from '../data/loader'; // Use the dynamic loader
import '../styles/Layout.css';

function Layout() {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { topicId } = useParams(); // Get current topicId from URL

  useEffect(() => {
    const loadTopics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // fetchTopics now uses the pre-processed data from loader.js
        const fetchedTopics = await fetchTopics();
        setTopics(fetchedTopics);
        if (fetchedTopics.length === 0) {
            setError("No topics found. Check the 'client/src/data' folder structure.");
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
        setError("Could not load topics.");
      } finally {
        setIsLoading(false);
      }
    };
    loadTopics();
  }, []); // Run only once on mount

  if (isLoading) {
    return <div className="page-loading">Loading Application...</div>;
  }

//   if (error) { // Display error within the layout if topics fail to load
//     return (
//         <div className="layout-container">
//             {/* Optionally render a minimal sidebar or skip it */}
//             <main className="main-content page-error">{error}</main>
//         </div>
//     );
//   }

  return (
    <div className="layout-container">
      <Sidebar topics={topics} activeTopicId={topicId} />
      <main className="main-content">
         {error ? <div className="page-error">{error}</div> : <Outlet />}
      </main>
    </div>
  );
}

export default Layout;