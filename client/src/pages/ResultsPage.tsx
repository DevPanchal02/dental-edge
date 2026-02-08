import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuizData, fetchTopicData, formatDisplayName } from '../services/loader';
import '../styles/ResultsPage.css';
import { Question, QuizResult } from '../types/quiz.types'; 
import { SectionType } from '../types/content.types';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Helper to strip HTML tags for plain-text previews.
 */
const extractTextFromHtml = (htmlString: string | undefined): string => {
    if (!htmlString || typeof htmlString !== 'string') return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
};

function ResultsPage() {
    const { topicId = '', sectionType = 'practice', quizId = '' } = useParams<{ 
        topicId: string; 
        sectionType: string; 
        quizId: string; 
    }>();
    
    const navigate = useNavigate();

    const [results, setResults] = useState<QuizResult | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
    const [topicName, setTopicName] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadResultsData = async () => {
            setIsLoading(true);
            setError(null);

            const resultsKey = `quizResults-${topicId}-${sectionType}-${quizId}`;
            const savedResultsString = localStorage.getItem(resultsKey);

            if (!savedResultsString) {
                if (isMounted) {
                    setError('No results found for this quiz. Please complete the quiz first.');
                    setIsLoading(false);
                }
                return;
            }

            try {
                const parsedResults = JSON.parse(savedResultsString) as QuizResult;
                
                const [topicData, allQuizData] = await Promise.all([
                    fetchTopicData(topicId),
                    getQuizData(topicId, sectionType, quizId)
                ]);

                if (isMounted) {
                    setResults(parsedResults);
                    setTopicName(topicData.name);
                    setQuizQuestions(allQuizData || []);
                }

            } catch (err: unknown) {
                // Handle parsing errors or fetch failures
                const msg = getErrorMessage(err, "Could not load results. Data might be corrupted or failed to fetch.");
                if (isMounted) {
                    setError(msg);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadResultsData();

        return () => { isMounted = false; };
    }, [topicId, sectionType, quizId]);

    const getQuestionPreviewText = (index: number): string => {
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
        <div className="page-error"> 
            {error}
            <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> 
                Back to Topic 
            </button>
        </div>
    );

    if (!results) return (
        <div className="page-info"> 
            No results available.
            <button onClick={() => navigate(`/app/topic/${topicId}`)} className="back-button"> 
                Back to Topic 
            </button>
        </div>
    );

    const totalForPercentage = results.totalValidQuestions > 0 ? results.totalValidQuestions : results.totalQuestions;
    const scorePercentage = totalForPercentage > 0
        ? ((results.score / totalForPercentage) * 100).toFixed(1)
        : "0.0";
    
    const quizTitle = results.quizName || 'Quiz Results';
    const currentSectionType = sectionType as SectionType;

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
                                    <Link to={`/app/quiz/${topicId}/${currentSectionType}/${quizId}`}
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
                                    <Link to={`/app/quiz/${topicId}/${currentSectionType}/${quizId}`}
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
                <button 
                    onClick={() => navigate(`/app/quiz/${topicId}/${currentSectionType}/${quizId}`, { state: { review: true, questionIndex: 0 } })} 
                    className="review-button"
                >
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