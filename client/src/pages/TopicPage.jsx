import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTopicData } from '../services/loader.js';
import { useLayout } from '../context/LayoutContext';
import '../styles/TopicPage.css';

function TopicPage() {
  const { topicId } = useParams();
  const { isSidebarEffectivelyPinned } = useLayout();

  const [topicData, setTopicData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // When fetchTopicData became async, this code handles the loading and error
  // states without needing any changes.
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
            setError(`Could not load data for topic: ${topicId}. Please check the network connection and backend function logs.`);
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

  // This render function is updated to work with the data structure from the API.
  const renderItemList = (items, sectionType) => {
    if (!items || items.length === 0) {
      return <p className="no-items-message">No {sectionType === 'practice' ? 'practice tests' : 'items'} available for this topic.</p>;
    }
    return (
      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id} className="list-item">
            <Link to={`/quiz/${topicId}/${sectionType}/${item.id}`} className="item-link">
              {item.name}
              {/* The question count is removed from here for efficiency. */}
              <span className="item-arrow">→</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  };


  if (isLoading) {
    return <div className="page-loading">Loading Topic Details from Cloud...</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  if (!topicData) {
    return <div className="page-info">Select a topic to begin.</div>;
  }

  const topicPageDynamicStyle = {
    marginLeft: isSidebarEffectivelyPinned ? '250px' : '0',
    width: isSidebarEffectivelyPinned ? 'calc(100% - 250px)' : '100%',
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