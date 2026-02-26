import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';

/**
 * Login page component.
 * Authenticates against /auth/login and stores JWT token.
 */
export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Login failed: ${response.status}`);
      }

      const { access_token } = await response.json();
      onLogin(access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-deep flex items-center justify-center relative">
      {/* Language switcher in top-right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher className="!text-xs !px-3 !py-1.5" />
      </div>

      <div className="bg-canvas border border-edge rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-on-canvas mb-1">{t('auth.title')}</h1>
        <p className="text-on-muted text-sm mb-6">{t('auth.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login">
          <div>
            <label className="block text-sm text-on-surface mb-1">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge-strong rounded-lg text-on-canvas text-sm focus:outline-none focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-on-surface mb-1">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge-strong rounded-lg text-on-canvas text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  );
}
