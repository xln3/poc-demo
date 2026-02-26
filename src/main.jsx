import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n/index.js'
import App from './App'
import LoginPage from './components/LoginPage'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

function Root() {
  const { token, login } = useAuth();

  if (!token) {
    return <LoginPage onLogin={login} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
