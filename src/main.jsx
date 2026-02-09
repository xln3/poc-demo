import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LoginPage from './components/LoginPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>,
)
