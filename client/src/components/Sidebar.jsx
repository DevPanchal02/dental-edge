import React from 'react';
import '../styles/Sidebar.css';

function Sidebar({ topics, selectedTopic, onTopicSelect }) {
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">TOPICS</h2>
      <nav>
        <ul>
          {Array.isArray(topics) && topics.map((topic) => (
            <li key={topic.id}>
              <button
                className={`topic-button ${selectedTopic?.id === topic.id ? 'active' : ''}`}
                onClick={() => onTopicSelect(topic)}
              >
                {topic.name}
                <span className="topic-arrow">→</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;