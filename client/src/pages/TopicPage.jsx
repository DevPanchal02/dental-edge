// FILE: client/src/pages/TopicPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTopicData } from '../services/loader.js';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { FaLock, FaChevronRight } from 'react-icons/fa'; // Updated import
import '../styles/TopicPage.css';

function TopicPage() {
  const { topicId } = useParams();
  const { isSidebarEffectivelyPinned } = useLayout();
  const { userProfile } = useAuth();

  const [topicData, setTopicData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!topicId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      setTopicData(null);
      
      try {
        const data = await fetchTopicData(topicId);
        if (isMounted) {
          setTopicData(data);
          if (!data.practiceTests?.length && !data.questionBanks?.length) {
              console.warn(`[TopicPage] No tests or banks found for ${topicId}`);
          }
        }
      } catch (err) {
         if (isMounted) {
            setError(`Could not load data for topic: ${topicId}.`);
         }
      } finally {
         if (isMounted) {
            setIsLoading(false);
         }
      }
    };
    loadData();

    return () => { isMounted = false; };

  }, [topicId]);

  const isLocked = (index) => {
    if (!userProfile) {
        return true; 
    }
    if (userProfile.tier === 'pro' || userProfile.tier === 'plus') {
      return false;
    }
    if (userProfile.tier === 'free') {
      return index > 0;
    }
    return true;
  };

  const renderItemList = (items, sectionType) => {
    if (!items || items.length === 0) {
      return <p className="no-items-message">No {sectionType === 'practice' ? 'practice tests' : 'items'} available for this topic.</p>;
    }
    return (
      <ul className="item-list">
        {items.map((item, index) => {
          const locked = isLocked(index);
          const destination = locked ? '/plans' : `/app/quiz/${topicId}/${sectionType}/${item.id}`;

          return (
            <li key={item.id} className={`list-item ${locked ? 'locked' : ''}`}>
              <Link to={destination} className="item-link">
                {/* Section 1: Name (takes up available space) */}
                <span className="item-name">{item.name}</span>

                {/* Section 2: Indicator (Lock OR Chevron icon on the right) */}
                <span className="item-indicator">
                  {locked ? <FaLock /> : <FaChevronRight />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };


  if (isLoading) {
    return <div className="page-loading">Loading Topic Details...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!topicData) {
    return <div className="page-info">Select a topic to begin.</div>;
  }

  const topicPageDynamicStyle = {
    marginLeft: isSidebarEffectivelyPinned ? 'var(--sidebar-width)' : '0',
    width: isSidebarEffectivelyPinned ? `calc(100% - var(--sidebar-width))` : '100%',
  };

  return (
    <div className="topic-page-container" style={topicPageDynamicStyle}>
      <h1 className="topic-title">{topicData.name}</h1>
      {error && <div className="page-error" style={{marginBottom: '20px', maxWidth:'800px'}}>{error}</div>}

      <section className="topic-section">
        <h2 className="section-title">Practice Tests</h2>
        {renderItemList(topicData.practiceTests, 'practice')}
      </section>

      <section className="topic-section">
        <h2 className="section-title">Question Banks</h2>
        {topicData.questionBanks && topicData.questionBanks.length > 0 ? (
          topicData.questionBanks.map((categoryGroup) => (
            <div key={categoryGroup.category} className="qbank-category">
              <h3 className="category-title">{categoryGroup.category}</h3>
              {renderItemList(categoryGroup.banks, 'qbank')}
            </div>
          ))
        ) : (
          <p className="no-items-message">No question banks found for this topic.</p>
        )}
      </section>
    </div>
  );
}

export default TopicPage;