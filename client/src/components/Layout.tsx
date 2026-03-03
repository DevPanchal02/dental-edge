import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { fetchTopics } from '../services/loader';
import { LayoutContext } from '../context/LayoutContext';
import '../styles/Layout.css';
import { TopicSummary } from '../types/content.types';

function Layout() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const { topicId: currentUrlTopicId } = useParams();
  const location = useLocation();

  const [sidebarPinned, setSidebarPinned] = useState<boolean>(true);
  const [sidebarHovered, setSidebarHovered] = useState<boolean>(false);

  // Ensure sidebar logic applies to all content pages including results
  const isContentPage = location.pathname.includes('/quiz/') || 
                        location.pathname.includes('/topic/') || 
                        location.pathname.includes('/results/');

  const actualSidebarIsOpen = sidebarPinned || (isContentPage && sidebarHovered);
  const isSidebarEffectivelyPinned = sidebarPinned && actualSidebarIsOpen;

  const handleSidebarMouseEnter = useCallback(() => {
    if (isContentPage && !sidebarPinned) {
      setSidebarHovered(true);
    }
  }, [isContentPage, sidebarPinned]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (isContentPage && !sidebarPinned) {
      setSidebarHovered(false);
    }
  }, [isContentPage, sidebarPinned]);
  
  const toggleSidebarPin = useCallback(() => {
    setSidebarPinned(prev => {
        const newState = !prev;
        if (newState) setSidebarHovered(false);
        return newState;
    });
  }, []);

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

  // --- STYLE FIX: Directly control the main content geometry ---
  // This ensures the content pushes over and shrinks, preventing overlap or hidden right margins.
  const mainContentStyle: React.CSSProperties = {
      marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
      width: isSidebarEffectivelyPinned ? 'calc(100% - var(--sidebar-width))' : '100%',
      transition: 'margin-left 0.3s ease-in-out, width 0.3s ease-in-out',
  };

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
        <main className="main-content" style={mainContentStyle}>
           <Outlet context={{ topics }} />
        </main>
      </div>
    </LayoutContext.Provider>
  );
}

export default Layout;