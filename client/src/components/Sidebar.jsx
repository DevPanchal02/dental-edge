import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TbLayoutSidebarLeftExpandFilled, TbLayoutSidebarLeftCollapseFilled } from 'react-icons/tb';
import { FaRegMoon, FaRegSun } from "react-icons/fa6";
import { FiLogOut, FiUser, FiHelpCircle } from 'react-icons/fi';
import appLogo from '../assets/logo.png'; // Import the logo
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
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const userName = currentUser?.displayName || currentUser?.email || 'User';
    const userProfilePic = currentUser?.photoURL;
    const userInitial = userName.charAt(0).toUpperCase();

    const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
    const [isMenuOpen, setMenuOpen] = useState(false);
    const navListRef = useRef(null);
    const menuRef = useRef(null);
    const menuTriggerRef = useRef(null);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                menuTriggerRef.current &&
                !menuTriggerRef.current.contains(event.target)
            ) {
                setMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to log out:", error);
        }
    };

    return (
        <aside
            className={`sidebar ${isOpen ? 'open' : 'closed'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="sidebar-top-header">
                <Link to="/app" className="sidebar-logo-link" title="Home">
                    <img src={appLogo} alt="Dental Edge Logo" className="sidebar-logo-img" />
                </Link>
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
                {isMenuOpen && (
                    <div ref={menuRef} className="user-menu-popup">
                        <div className="user-menu-email-section">
                           <FiUser /> <span>{currentUser?.email}</span>
                        </div>
                        <Link to="/contact" className="user-menu-help-button">
                           <FiHelpCircle /> Help
                        </Link>
                        <div className="user-menu-separator" />
                        <button onClick={handleLogout} className="user-menu-logout-button">
                           <FiLogOut /> Log out
                        </button>
                    </div>
                )}

                <div
                    className="sidebar-footer-content"
                    ref={menuTriggerRef}
                    onClick={() => setMenuOpen(!isMenuOpen)}
                >
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
                    <Link to="/plans" className="upgrade-button" onClick={(e) => e.stopPropagation()}>
                        Upgrade
                    </Link>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;