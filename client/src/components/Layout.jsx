// FILE: client/src/components/Layout.jsx

import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { fetchTopics } from '../services/loader.js';
import { LayoutContext } from '../context/LayoutContext';
import '../styles/Layout.css';

function Layout() {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { topicId: currentUrlTopicId } = useParams();
  const location = useLocation();

  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const isContentPage = location.pathname.includes('/quiz/') || location.pathname.includes('/topic/');
  const actualSidebarIsOpen = sidebarPinned || (isContentPage && sidebarHovered);
  const isSidebarEffectivelyPinned = sidebarPinned && actualSidebarIsOpen;

  const handleSidebarMouseEnter = () => {
    if (isContentPage && !sidebarPinned) {
      setSidebarHovered(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (isContentPage && !sidebarPinned) {
      setSidebarHovered(false);
    }
  };
  
  const toggleSidebarPin = () => {
    const newPinnedState = !sidebarPinned;
    setSidebarPinned(newPinnedState);
    if (newPinnedState) {
        setSidebarHovered(false); 
    }
  };

  useEffect(() => {
    const loadTopics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedTopics = await fetchTopics();
        setTopics(fetchedTopics);
        if (!fetchedTopics || fetchedTopics.length === 0) {
            setError("No topics could be loaded from the server.");
        }
      } catch (err) {
        console.error("Error fetching topics in Layout.jsx:", err);
        setError("Could not load topics. Please check the network connection and function logs.");
      } finally {
        setIsLoading(false);
      }
    };
    loadTopics();
  }, []);

  if (isLoading) {
    return <div className="page-loading">Loading Application...</div>;
  }
  
  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <LayoutContext.Provider value={{ isSidebarOpen: actualSidebarIsOpen, isSidebarEffectivelyPinned }}>
      <div className="layout-container-wrapper">
        {isContentPage && !actualSidebarIsOpen && (
          <div
            className="sidebar-hover-trigger-zone"
            onMouseEnter={handleSidebarMouseEnter}
          ></div>
        )}
        <Sidebar
          topics={topics}
          activeTopicId={currentUrlTopicId}
          isOpen={actualSidebarIsOpen}
          // --- THIS IS THE FIX ---
          isPinned={sidebarPinned} // Corrected variable name
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          onPinToggle={toggleSidebarPin}
          isContentPage={isContentPage}
        />
        <main className="main-content">
           <Outlet context={{ topics }} />
        </main>
      </div>
    </LayoutContext.Provider>
  );
}

export default Layout;