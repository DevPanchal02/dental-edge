import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext'; 
import '../styles/Sidebar.css';

const PinIcon = ({ pinned }) => (
  <span style={{ marginRight: '8px', display: 'inline-block', fontSize: '1em' }}>
    {pinned ? '🔒' : '🔓'}
  </span>
);

function Sidebar({ 
    topics, 
    activeTopicId, 
    isOpen, 
    isPinned, 
    onMouseEnter, 
    onMouseLeave, 
    onPinToggle,
    isContentPage 
}) {
    const { theme, toggleTheme } = useTheme();
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error("Failed to log out:", error);
        alert("Failed to log out. Please try again.");
      }
    };
    

    const handleResetProgress = () => {
        const confirmation = window.confirm(
            "Are you sure you want to reset ALL quiz progress?\n" +
            "This will clear saved answers, times, and results for ALL topics and quizzes.\n" +
            "This action cannot be undone."
        );
        if (confirmation) {
            try {
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('quizState-') || key.startsWith('quizResults-')) {
                        localStorage.removeItem(key);
                    }
                });
                alert("All quiz progress has been reset.");
                window.location.reload();
            } catch (error) {
                console.error("Error resetting progress:", error);
            }
        }
    };

    return (
        <aside 
            className={`sidebar ${isOpen ? 'open' : 'closed'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="sidebar-header">
                <h2 className="sidebar-title">TOPICS</h2>
                {isContentPage && isOpen && (
                    <button 
                        onClick={onPinToggle} 
                        className="pin-toggle-button" 
                        title={isPinned ? "Unpin Sidebar (allow overlay)" : "Pin Sidebar Open (push content)"}
                    >
                        <PinIcon pinned={isPinned} />
                    </button>
                )}
            </div>
            <nav>
                <ul>
                    {topics && topics.length > 0 ? (
                        topics.map((topic) => (
                            <li key={topic.id}>
                                <NavLink
                                    to={`/app/topic/${topic.id}`}
                                    className={({ isActive }) =>
                                    `topic-button ${isActive || topic.id === activeTopicId ? 'active' : ''}`
                                    }
                                >
                                    {topic.name}
                                    <span className="topic-arrow">→</span>
                                </NavLink>
                            </li>
                        ))
                    ) : (
                         <li><p className="no-topics-sidebar">No topics loaded.</p></li>
                    )}
                </ul>
            </nav>

            <div className="sidebar-actions">
                {currentUser && <p className="user-email">{currentUser.displayName || currentUser.email}</p>}
                
                {/* Link to the new Plans page */}
                <Link to="/plans" className="sidebar-action-button">Upgrade Plan</Link>

                <button onClick={toggleTheme} className="sidebar-action-button">
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </button>
                <button onClick={handleResetProgress} className="sidebar-action-button danger">
                    Reset All Progress
                </button>
                <button onClick={handleLogout} className="sidebar-action-button">
                    Logout
                </button>
            </div>
        </aside>
    );
}

export default Sidebar