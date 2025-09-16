import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TbLayoutSidebarLeftExpandFilled, TbLayoutSidebarLeftCollapseFilled } from 'react-icons/tb';
import { FaRegMoon, FaRegSun  } from "react-icons/fa6";
import '../styles/Sidebar.css';

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
    const { theme, toggleTheme } = useTheme();
    const userName = currentUser?.displayName || currentUser?.email || 'User';
    const userProfilePic = currentUser?.photoURL;
    const userInitial = userName.charAt(0).toUpperCase();

    const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
    const navListRef = useRef(null);

    useEffect(() => {
        const activeElement = navListRef.current?.querySelector('.topic-button.active');
        
        if (activeElement) {
            const top = activeElement.offsetTop;
            const height = activeElement.offsetHeight;
            
            setIndicatorStyle({ top, height, opacity: 1 });
        } else {
            setIndicatorStyle(prevStyle => ({ ...prevStyle, opacity: 0 }));
        }
    }, [activeTopicId, topics, isOpen]);

    return (
        <aside 
            className={`sidebar ${isOpen ? 'open' : 'closed'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="sidebar-top-header">
                <h1 className="sidebar-logo">Dental Edge</h1>
                {isContentPage && isOpen && (
                    <div className="sidebar-header-actions">
                        <button
                            onClick={toggleTheme}
                            className="theme-toggle-button"
                            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                        >
                            {theme === 'light' ? <FaRegMoon /> : <FaRegSun />}
                        </button>
                        <button 
                            onClick={onPinToggle} 
                            className="pin-toggle-button" 
                            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
                        >
                            {isPinned ? <TbLayoutSidebarLeftCollapseFilled /> : <TbLayoutSidebarLeftExpandFilled />}
                        </button>
                    </div>
                )}
            </div>

            <nav className="topics-nav">
                <h2 className="sidebar-title">Topics</h2>
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