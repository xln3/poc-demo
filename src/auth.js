/**
 * Authentication state management.
 *
 * Token is stored in memory only (not localStorage) for security.
 * Users must re-login after page refresh.
 */

let _token = null;
let _onAuthChange = null;

export function setToken(token) {
  _token = token;
  if (_onAuthChange) _onAuthChange(token);
}

export function getToken() {
  return _token;
}

export function clearToken() {
  _token = null;
  if (_onAuthChange) _onAuthChange(null);
}

export function onAuthChange(callback) {
  _onAuthChange = callback;
}

/**
 * Returns headers with Authorization if token is available.
 */
export function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }
  return headers;
}

/**
 * Fetch wrapper that includes auth header.
 */
export async function authFetch(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearToken();
  }

  return response;
}
