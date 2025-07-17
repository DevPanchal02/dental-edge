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

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  useEffect(() => {
    const onQuizPage = location.pathname.startsWith('/quiz/');
    const onTopicPage = location.pathname.startsWith('/topic/');

    if (onQuizPage) {
      setSidebarPinned(false); // Default unpinned on quiz pages
      setSidebarHovered(false);
    } else if (onTopicPage) {
      setSidebarPinned(true);  // Default pinned on topic (selection) pages
      setSidebarHovered(false);
    } else {
      setSidebarPinned(false); // Default to unpinned for other general pages
      setSidebarHovered(false);
    }
  }, [location.pathname]);

  const isContentPage = location.pathname.startsWith('/quiz/') || location.pathname.startsWith('/topic/');
  const actualSidebarIsOpen = sidebarPinned || (isContentPage && sidebarHovered);
  const isSidebarEffectivelyPinned = sidebarPinned && actualSidebarIsOpen; // True if pinned and thus should affect layout

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
        if (fetchedTopics.length === 0) {
            setError("No topics could be loaded.");
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
        setError("Could not load topics.");
      } finally {
        setIsLoading(false);
      }
    };
    loadTopics();
  }, []);

  if (isLoading) {
    return <div className="page-loading">Loading Application...</div>;
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
          isPinned={sidebarPinned}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          onPinToggle={toggleSidebarPin}
          isContentPage={isContentPage}
        />
        <main className="main-content"> {/* main-content no longer gets margin from CSS class */}
           {error ? <div className="page-error">{error}</div> : <Outlet />}
        </main>
      </div>
    </LayoutContext.Provider>
  );
}

export default Layout;