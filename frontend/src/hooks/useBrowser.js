import { useState, useEffect, useRef } from 'react';
import {
  healthCheck, initBrowser, shutdownBrowser,
  getSessionStatus, clearSession, startLogin, confirmLogin,
} from '../api';
import { PLAYER_NAMES } from '../constants';

export function useBrowser({ playerCount, mode, onError }) {
  const [connected, setConnected]               = useState(false);
  const [browserReady, setBrowserReady]         = useState(false);
  const [initingBrowser, setInitingBrowser]     = useState(false);
  const [initializedCount, setInitializedCount] = useState(0);
  const [shuttingDown, setShuttingDown]         = useState(false);
  const [sessionStatus, setSessionStatus]       = useState(null);
  const [clearingSession, setClearingSession]   = useState(false);
  const [signingIn, setSigningIn]               = useState(false);
  const [confirmingLogin, setConfirmingLogin]   = useState(false);

  const initAbortRef = useRef(null);

  // Auto-connect on mount
  useEffect(() => {
    healthCheck()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, []);

  // Auto-check Gemini session when in browser mode
  useEffect(() => {
    if (connected && mode === 'browser') {
      getSessionStatus()
        .then(d => setSessionStatus(d.has_session))
        .catch(() => setSessionStatus(null));
    }
  }, [connected, mode]);

  const reconnect = () => {
    setConnected(false);
    healthCheck()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  };

  const init = async () => {
    const controller = new AbortController();
    initAbortRef.current = controller;
    setInitingBrowser(true);
    try {
      await initBrowser(PLAYER_NAMES.slice(0, playerCount), controller.signal);
      setBrowserReady(true);
      setInitializedCount(playerCount);
    } catch (e) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
      onError(e.response?.data?.detail || e.message || 'Browser init failed');
    } finally {
      setInitingBrowser(false);
      initAbortRef.current = null;
    }
  };

  const stop = async () => {
    setShuttingDown(true);
    try {
      await shutdownBrowser();
      setBrowserReady(false);
      setInitializedCount(0);
    } catch (e) {
      onError(e.response?.data?.detail || e.message || 'Shutdown failed');
    } finally {
      setShuttingDown(false);
    }
  };

  const checkSession = () => {
    setSessionStatus(null);
    getSessionStatus()
      .then(d => setSessionStatus(d.has_session))
      .catch(() => setSessionStatus(null));
  };

  const clearSessionFn = async () => {
    setClearingSession(true);
    try { await clearSession(); setSessionStatus(false); }
    catch { /* ignore */ }
    finally { setClearingSession(false); }
  };

  const startLoginFn = async () => {
    setSigningIn(true);
    try { await startLogin(); }
    catch (e) {
      onError(e.response?.data?.detail || e.message || 'Could not open login browser');
      setSigningIn(false);
    }
  };

  const confirmLoginFn = async () => {
    setConfirmingLogin(true);
    try {
      await confirmLogin();
      setSessionStatus(true);
      setSigningIn(false);
    } catch (e) {
      onError(e.response?.data?.detail || e.message || 'Login confirmation failed');
    } finally {
      setConfirmingLogin(false);
    }
  };

  // Full teardown — called by PokerTable on end/restart
  const shutdown = async () => {
    if (initAbortRef.current) { initAbortRef.current.abort(); initAbortRef.current = null; }
    setInitingBrowser(false);
    setShuttingDown(true);
    try { await shutdownBrowser(); } catch { /* ignore */ }
    finally { setShuttingDown(false); }
    setBrowserReady(false);
    setInitializedCount(0);
  };

  const resetSession = () => setSessionStatus(null);

  return {
    // state
    connected, browserReady, initingBrowser, initializedCount,
    shuttingDown, sessionStatus, clearingSession, signingIn, confirmingLogin,
    // actions
    reconnect, init, stop, checkSession,
    clearSession: clearSessionFn,
    startLogin: startLoginFn,
    confirmLogin: confirmLoginFn,
    shutdown, resetSession,
  };
}
