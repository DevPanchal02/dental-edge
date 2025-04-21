// FILE: client/src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import '../styles/Sidebar.css';

// No changes needed from the previous version using NavLink
function Sidebar({ topics, activeTopicId }) {
  if (!topics || topics.length === 0) {
      return (
          <aside className="sidebar">
              <h2 className="sidebar-title">TOPICS</h2>
              <p className="no-topics-sidebar">No topics loaded.</p>
          </aside>
      );
  }

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">TOPICS</h2>
      <nav>
        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              {/* NavLink adds 'active' class automatically */}
              <NavLink
                to={`/topic/${topic.id}`}
                className={({ isActive }) =>
                  `topic-button ${isActive ? 'active' : ''}`
                }
              >
                {topic.name}
                <span className="topic-arrow">→</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;