import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LoginPage from './components/LoginPage'
import { setToken, getToken, onAuthChange } from './auth'
import './index.css'

function Root() {
  const [authenticated, setAuthenticated] = useState(!!getToken());

  useEffect(() => {
    onAuthChange((token) => setAuthenticated(!!token));
  }, []);

  const handleLogin = (token) => {
    setToken(token);
  };

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
