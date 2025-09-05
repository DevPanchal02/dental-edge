import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuizData, getQuizMetadata, fetchTopicData, formatDisplayName } from '../services/loader';
import '../styles/ResultsPage.css';

const extractTextFromHtml = (htmlString) => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    let text = tempDiv.textContent || tempDiv.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    return text;
};

function ResultsPage() {
    const { topicId, sectionType, quizId } = useParams();
    const navigate = useNavigate();

    const [results, setResults] = useState(null);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [topicName, setTopicName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // This useEffect hook is now properly async.
    useEffect(() => {
        const loadResultsData = async () => {
            setIsLoading(true);
            setError(null);

            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResultsString = localStorage.getItem(resultsKey);

            if (!savedResultsString) {
                setError('No results found for this quiz. Please complete the quiz first.');
                setIsLoading(false);
                return;
            }

            try {
                const parsedResults = JSON.parse(savedResultsString);
                setResults(parsedResults);

                // Fetch topic and quiz data asynchronously
                const [topicData, allQuizData] = await Promise.all([
                    fetchTopicData(topicId),
                    getQuizData(topicId, sectionType, quizId)
                ]);

                setTopicName(topicData.name);
                setQuizQuestions(allQuizData || []);

            } catch (e) {
                console.error("Error loading results page data:", e);
                setError('Could not load results. Data might be corrupted or failed to fetch.');
            } finally {
                setIsLoading(false);
            }
        };

        loadResultsData();
    }, [topicId, sectionType, quizId]);

    const getQuestionPreviewText = (index) => {
        if (quizQuestions && quizQuestions.length > index && quizQuestions[index]) {
            const questionItem = quizQuestions[index];
            if (questionItem.question && questionItem.question.html_content) {
                const text = extractTextFromHtml(questionItem.question.html_content);
                return text.substring(0, 70) + (text.length > 70 ? "..." : "");
            }
        }
        return `Question ${index + 1} text unavailable`;
    };

    if (isLoading) return <div className="page-loading">Loading Results...</div>;
    if (error && !results) return (
        <div className="page-error"> {error}
            <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );
     if (error && results) {
         console.warn("Results page error:", error);
     }
    if (!results) return (
        <div className="page-info"> No results available.
            <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> Back to Topic </button>
        </div>
    );

    const totalForPercentage = results.totalValidQuestions > 0 ? results.totalValidQuestions : results.totalQuestions;
    const scorePercentage = totalForPercentage > 0
        ? ((results.score / totalForPercentage) * 100).toFixed(1)
        : 0;
    
    // Use the quizName from the stored results object
    const quizTitle = results.quizName || 'Quiz Results';

    return (
        <div className="results-page-container">
            <div className="results-header">
                <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button-results">
                     ← Back to {topicName || formatDisplayName(topicId)}
                </button>
                <h1 className="results-title">{quizTitle} - Results</h1>
            </div>

            {error && <div className="page-error" style={{maxWidth: '800px', margin: '0 auto 20px auto'}}>{error}</div>}

            <div className="results-summary">
                <h2>Your Score</h2>
                <p className="score">
                    <span className="score-value">{results.score}</span> / {totalForPercentage}
                    <span className="score-percentage"> ({scorePercentage}%)</span>
                </p>
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
                                    <Link to={`/quiz/${topicId}/${sectionType}/${quizId}`}
                                          state={{ review: true, questionIndex: index }}>
                                        Q{index + 1}: {getQuestionPreviewText(index)}
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
                                    <Link to={`/quiz/${topicId}/${sectionType}/${quizId}`}
                                          state={{ review: true, questionIndex: index }}>
                                         Q{index + 1}: {getQuestionPreviewText(index)}
                                    </Link>
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
                <button onClick={() => navigate(`/app/quiz/${topicId}/${sectionType}/${quizId}`, { state: { review: true, questionIndex: 0 } })} className="review-button">
                    Review All Questions
                </button>
                 <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-to-topic-button">
                    Back to Topic List
                </button>
            </div>
        </div>
    );
}

export default ResultsPage;