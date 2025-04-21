// FILE: client/src/pages/ResultsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuizData, getQuizMetadata, fetchTopicData, formatDisplayName } from '../data/loader'; // Import formatDisplayName
import '../styles/ResultsPage.css'; // Make sure this CSS file exists

function ResultsPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();

    const [results, setResults] = useState(null);
    const [quizQuestions, setQuizQuestions] = useState([]); // Store full question data for review
    const [quizTitle, setQuizTitle] = useState('');
    const [topicName, setTopicName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
        const savedResultsString = localStorage.getItem(resultsKey);

        if (!savedResultsString) {
            setError('No results found for this quiz. Please complete the quiz first.');
            setIsLoading(false);
            return;
        }

        let parsedResults;
        try {
            parsedResults = JSON.parse(savedResultsString);
            setResults(parsedResults);
            setQuizTitle(parsedResults.quizName || 'Quiz Results');

            // Fetch topic name for breadcrumbs/title
            fetchTopicData(topicId)
                .then(topicData => setTopicName(topicData.name))
                .catch(err => console.error("Error fetching topic name:", err));

            // Fetch the full question data again for review purposes
            const allData = getQuizData(topicId, sectionType, quizId);
            if (allData && Array.isArray(allData)) {
                 // Ensure questions are available even if results are minimal
                 setQuizQuestions(allData);
            } else {
                console.warn("Could not retrieve full quiz data for review.");
                setError("Could not load question details for review.");
                // Results can still be shown, but review might be limited
            }

        } catch (e) {
            console.error("Error parsing results from localStorage:", e);
            setError('Could not load results. Data might be corrupted.');
            // Optionally clear corrupted data: localStorage.removeItem(resultsKey);
        } finally {
            setIsLoading(false);
        }

    }, [topicId, sectionType, quizId]); // Rerun if params change

    const getQuestionText = (index) => {
        // Check if quizQuestions has data and the index is valid
        if (quizQuestions && quizQuestions.length > index && quizQuestions[index]) {
            const question = quizQuestions[index];
            // Add an extra check for the nested question object and text property
            if (question.question && question.question.text) {
                return question.question.text;
            }
        }
        // Fallback message
        return `Question ${index + 1} text unavailable`;
    };


    // --- Render Logic ---
    if (isLoading) return <div className="page-loading">Loading Results...</div>;
    if (error && !results) return ( // Show error prominently if results couldn't load at all
        <div className="page-error"> {error}
            <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );
     // If results loaded but there was another error (like fetching questions)
     if (error && results) {
         console.warn("Results page error:", error); // Log the secondary error
     }

    if (!results) return ( // Should be caught by error above, but as a fallback
        <div className="page-info"> No results available.
            <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );

    // Use totalValidQuestions for percentage calculation if available
    const totalForPercentage = results.totalValidQuestions > 0 ? results.totalValidQuestions : results.totalQuestions;
    const scorePercentage = totalForPercentage > 0
        ? ((results.score / totalForPercentage) * 100).toFixed(1)
        : 0;

    return (
        <div className="results-page-container">
            <div className="results-header">
                <button onClick={() => navigate(`/topic/${topicId}`)} className="back-button-results">
                     ← Back to {topicName || formatDisplayName(topicId)}
                </button>
                <h1 className="results-title">{quizTitle} - Results</h1>
            </div>

            {/* Display secondary error if needed */}
            {error && <div className="page-error" style={{maxWidth: '800px', margin: '0 auto 20px auto'}}>{error}</div>}

            <div className="results-summary">
                <h2>Your Score</h2>
                <p className="score">
                    <span className="score-value">{results.score}</span> / {totalForPercentage}
                    <span className="score-percentage"> ({scorePercentage}%)</span>
                </p>
                 {/* Optionally show raw total if different */}
                {results.totalQuestions !== totalForPercentage &&
                     <p className="total-raw-info">(Based on {totalForPercentage} valid questions out of {results.totalQuestions} total items)</p>
                }
                <p className="timestamp">Completed: {new Date(results.timestamp).toLocaleString()}</p>
            </div>

            <div className="results-details">
                <div className="results-column correct-column">
                    <h3>Correct ({results.correctIndices?.length || 0})</h3>
                    {results.correctIndices && results.correctIndices.length > 0 ? (
                        <ul>
                            {results.correctIndices.map(index => (
                                <li key={`correct-${index}`}>
                                    {/* Pass results state to review link */}
                                    <Link to={`/quiz/${topicId}/${sectionType}/${quizId}`}
                                          state={{ review: true, questionIndex: index }}>
                                        Q{index + 1}: {getQuestionText(index).substring(0, 50)}...
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <p>None</p>}
                </div>

                <div className="results-column incorrect-column">
                    <h3>Incorrect / Unanswered ({results.incorrectIndices?.length || 0})</h3>
                     {results.incorrectIndices && results.incorrectIndices.length > 0 ? (
                        <ul>
                            {results.incorrectIndices.map(index => (
                                <li key={`incorrect-${index}`}>
                                     {/* Pass results state to review link */}
                                    <Link to={`/quiz/${topicId}/${sectionType}/${quizId}`}
                                          state={{ review: true, questionIndex: index }}>
                                         Q{index + 1}: {getQuestionText(index).substring(0, 50)}...
                                    </Link>
                                     {/* Optionally show user's incorrect answer */}
                                     {results.userAnswers[index] &&
                                         <span className="user-answer-preview"> (Your answer: {results.userAnswers[index]})</span>
                                     }
                                </li>
                            ))}
                        </ul>
                     ) : <p>None</p>}
                </div>
            </div>

             <div className="results-actions">
                <button onClick={() => navigate(`/quiz/${topicId}/${sectionType}/${quizId}`, { state: { review: true, questionIndex: 0 } })} className="review-button">
                    Review All Questions
                </button>
                 <button onClick={() => navigate(`/topic/${topicId}`)} className="back-to-topic-button">
                    Back to Topic List
                </button>
            </div>
        </div>
    );
}

export default ResultsPage;