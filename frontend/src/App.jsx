import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';
import { OrchestrationProvider } from './context/OrchestrationContext';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', color: 'red', background: '#fee', minHeight: '100vh', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          <h2>Application Crashed!</h2>
          <p>{this.state.error && this.state.error.toString()}</p>
          <hr />
          <p>{this.state.errorInfo && this.state.errorInfo.componentStack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Router>
              <Toaster position="bottom-right" toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--surface-raised)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  padding: '8px 12px',
                }
              }} />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/dashboard" element={
                  <OrchestrationProvider>
                    <Dashboard />
                  </OrchestrationProvider>
                } />
                <Route path="*" element={<LandingPage />} />
              </Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
