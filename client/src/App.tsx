import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import TopicPage from './pages/TopicPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import PlansPage from './pages/PlansPage';
import ContactPage from './pages/ContactPage';
import { useAuth } from './context/AuthContext';
import { LayoutContext } from './context/LayoutContext';

function App() {
  const location = useLocation();
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Initializing Application...</div>;
  }

  // Default context value for Preview Mode (Sidebar is hidden/not pinned)
  const previewLayoutContext = { 
    isSidebarOpen: false, 
    isSidebarEffectivelyPinned: false 
  };

  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/plans" element={<PlansPage />} />

      {/* --- Wrap Preview Route in Context Provider --- */}
      <Route
        path="/preview/quiz/:topicId/:sectionType/:quizId"
        element={
          <LayoutContext.Provider value={previewLayoutContext}>
            <QuizPage key={location.pathname} isPreviewMode={true} />
          </LayoutContext.Provider>
        }
      />

      {/* --- Protected Application Routes --- */}
      <Route path="/app" element={currentUser ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Navigate to="/app/topic/biology" replace />} />
        <Route path="topic/:topicId" element={<TopicPage />} />
        <Route
            path="quiz/:topicId/:sectionType/:quizId"
            element={<QuizPage key={location.pathname} />}
        />
        <Route path="results/:topicId/:sectionType/:quizId" element={<ResultsPage />} />
      </Route>
    </Routes>
  );
}

export default App;