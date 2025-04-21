// FILE: client/src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import '../styles/Sidebar.css';

function Sidebar({ topics, activeTopicId }) {

    const handleResetProgress = () => {
        // Confirmation dialog
        const confirmation = window.confirm(
            "Are you sure you want to reset ALL quiz progress?\n" +
            "This will clear saved answers, times, and results for ALL topics and quizzes.\n" +
            "This action cannot be undone."
        );

        if (confirmation) {
            console.log("Resetting all quiz progress...");
            try {
                // Iterate through localStorage keys and remove relevant ones
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('quizState-') || key.startsWith('quizResults-')) {
                        localStorage.removeItem(key);
                        console.log(`Removed item: ${key}`);
                    }
                });
                alert("All quiz progress has been reset.");
                // Optionally reload the page to reflect the reset state immediately
                window.location.reload();
            } catch (error) {
                console.error("Error resetting progress:", error);
                alert("An error occurred while resetting progress.");
            }
        } else {
            console.log("Progress reset cancelled.");
        }
    };


    if (!topics || topics.length === 0) {
        return (
            <aside className="sidebar">
                <h2 className="sidebar-title">TOPICS</h2>
                <p className="no-topics-sidebar">No topics loaded.</p>
                {/* Optionally show reset button even if topics fail? */}
                 <div className="sidebar-actions">
                    <button onClick={handleResetProgress} className="reset-button">
                        Reset All Progress
                    </button>
                </div>
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

            {/* Reset Button Section */}
            <div className="sidebar-actions">
                <button onClick={handleResetProgress} className="reset-button">
                    Reset All Progress
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;