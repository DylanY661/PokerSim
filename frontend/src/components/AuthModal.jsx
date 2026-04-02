import { useState } from 'react';

export default function AuthModal({ onClose, onLogin, onRegister }) {
  const [tab,      setTab]      = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        await onLogin(username, password);
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        await onRegister(username, password);
      }
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-zinc-200 rounded-md shadow-lg w-full max-w-sm p-6">

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-zinc-100 rounded p-1">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setPassword(''); }}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors
                ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-200'}`}
            >
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="mt-1 w-full bg-zinc-50 border border-zinc-300 text-zinc-900 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {tab === 'register' && (
              <p className="text-zinc-500 text-xs mt-1">At least 8 characters</p>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 font-semibold text-sm text-white transition-colors"
          >
            {loading ? '…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
