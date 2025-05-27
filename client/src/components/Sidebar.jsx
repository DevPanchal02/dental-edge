import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext'; // Import useTheme
import '../styles/Sidebar.css';

function Sidebar({ topics, activeTopicId }) {
    const { theme, toggleTheme } = useTheme(); // Use the theme context

    const handleResetProgress = () => {
        const confirmation = window.confirm(
            "Are you sure you want to reset ALL quiz progress?\n" +
            "This will clear saved answers, times, and results for ALL topics and quizzes.\n" +
            "This action cannot be undone."
        );

        if (confirmation) {
            console.log("Resetting all quiz progress...");
            try {
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('quizState-') || key.startsWith('quizResults-')) {
                        localStorage.removeItem(key);
                        console.log(`Removed item: ${key}`);
                    }
                });
                alert("All quiz progress has been reset.");
                window.location.reload();
            } catch (error) {
                console.error("Error resetting progress:", error);
                alert("An error occurred while resetting progress.");
            }
        } else {
            console.log("Progress reset cancelled.");
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2 className="sidebar-title">TOPICS</h2>
            </div>
            <nav>
                <ul>
                    {topics && topics.length > 0 ? (
                        topics.map((topic) => (
                            <li key={topic.id}>
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
                        ))
                    ) : (
                         <li><p className="no-topics-sidebar">No topics loaded.</p></li>
                    )}
                </ul>
            </nav>

            <div className="sidebar-actions">
                <button onClick={toggleTheme} className="theme-toggle-button">
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </button>
                <button onClick={handleResetProgress} className="reset-button">
                    Reset All Progress
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;