// FILE: client/src/pages/TopicPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTopicData } from '../data/loader';
import { useLayout } from '../context/LayoutContext'; // Import useLayout
import '../styles/TopicPage.css';

function TopicPage() {
  const { topicId } = useParams();
  const { isSidebarEffectivelyPinned } = useLayout(); // Consume layout context

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
      console.log(`[TopicPage] Loading data for topic: ${topicId}`);
      try {
        const data = await fetchTopicData(topicId);
        if (isMounted) {
          console.log(`[TopicPage] Received data for ${topicId}:`, data);
          setTopicData(data);
          if (!data.practiceTests?.length && !data.questionBanks?.length) {
              console.warn(`[TopicPage] No tests or banks found for ${topicId}`);
          }
        }
      } catch (err) {
        console.error(`[TopicPage] Error fetching data for topic ${topicId}:`, err);
         if (isMounted) {
            setError(`Could not load data for topic: ${topicId}. ${err.message}`);
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

  const renderItemList = (items, sectionType) => {
    if (!items || items.length === 0) {
      return <p className="no-items-message">No {sectionType === 'practice' ? 'practice tests' : 'items'} found.</p>;
    }
    return (
      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id} className={`list-item ${!item.dataAvailable ? 'disabled' : ''}`}>
            {item.dataAvailable ? (
              <Link to={`/quiz/${topicId}/${sectionType}/${item.id}`} className="item-link">
                {item.name}
                <span className="item-details">({item.totalQuestions || 'N/A'} Qs)</span>
                <span className="item-arrow">→</span>
              </Link>
            ) : (
              <span className="item-link-disabled">
                {item.name}
                <span className="item-details">(Data N/A)</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  };


  if (isLoading) {
    return <div className="page-loading">Loading Topic Details...</div>;
  }

  if (error && !topicData) {
    return <div className="page-error">{error}</div>;
  }

  if (!topicData) {
    return <div className="page-info">Topic '{topicId}' not found or failed to load content.</div>;
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