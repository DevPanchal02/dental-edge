import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Sidebar.css';

const PinIcon = () => (
  <div className="pin-icon-wrapper">
    <div className="pin-icon-body"></div>
  </div>
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
    const { currentUser } = useAuth();
    const userName = currentUser?.displayName || currentUser?.email || 'User';
    const userProfilePic = currentUser?.photoURL;
    const userInitial = userName.charAt(0).toUpperCase();

    // --- START: Logic for the animated indicator ---
    const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
    const navListRef = useRef(null);

    useEffect(() => {
        // Find the active link element within the list
        const activeElement = navListRef.current?.querySelector('.topic-button.active');
        
        if (activeElement) {
            // Get its position and size relative to the list container
            const top = activeElement.offsetTop;
            const height = activeElement.offsetHeight;
            
            // Update the state to move the indicator
            setIndicatorStyle({ top, height, opacity: 1 });
        } else {
            // If no active topic, hide the indicator
            setIndicatorStyle(prevStyle => ({ ...prevStyle, opacity: 0 }));
        }
    }, [activeTopicId, topics, isOpen]); // Recalculate when active topic, topics list, or sidebar visibility changes
    // --- END: Logic for the animated indicator ---

    return (
        <aside 
            className={`sidebar ${isOpen ? 'open' : 'closed'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="sidebar-top-header">
                <h1 className="sidebar-logo">Dental Edge</h1>
                {isContentPage && isOpen && (
                    <button 
                        onClick={onPinToggle} 
                        className="pin-toggle-button" 
                        title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
                    >
                        <PinIcon />
                    </button>
                )}
            </div>

            <nav className="topics-nav">
                <h2 className="sidebar-title">Topics</h2>
                {/* Add the ref and the indicator element to the list */}
                <ul ref={navListRef}>
                    <div className="active-topic-indicator" style={indicatorStyle} />
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
                                </NavLink>
                            </li>
                        ))
                    ) : (
                        <li className="no-topics-sidebar">No topics loaded.</li>
                    )}
                </ul>
            </nav>

            <div className="sidebar-footer">
                {currentUser && (
                    <div className="user-profile">
                        {userProfilePic ? (
                            <img src={userProfilePic} alt="Profile" className="profile-picture" />
                        ) : (
                            <div className="profile-initial">{userInitial}</div>
                        )}
                        <span className="user-name">{userName}</span>
                    </div>
                )}
                <Link to="/plans" className="upgrade-button">Upgrade</Link>
            </div>
        </aside>
    );
}

export default Sidebar;