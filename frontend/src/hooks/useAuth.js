import { useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe } from '../api';

const TOKEN_KEY = 'pk_token';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  // On mount, restore session from stored token
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }
    getMe(stored)
      .then(u => { setUser(u); setToken(stored); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username, password) => {
    const data = await loginUser(username, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({ username: data.username });
    return data;
  }, []);

  const register = useCallback(async (username, password) => {
    const data = await registerUser(username, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({ username: data.username });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return { user, token, loading, login, register, logout };
}
