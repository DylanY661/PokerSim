export default function HistoryScreen({ games, loading, onBack, isAuthenticated, onShowAuth }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-sm text-black"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Game History</h1>
        </div>
        {!isAuthenticated ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm mb-3">Sign in to view your game history</p>
            <button
              onClick={onShowAuth}
              className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 text-sm font-medium text-black transition-colors"
            >
              Sign In / Register
            </button>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-sm animate-pulse">Loading…</p>
        ) : games.length === 0 ? (
          <p className="text-slate-500 text-sm">No games played yet.</p>
        ) : (
          <div className="space-y-2">
            {games.map(g => (
              <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 flex items-center gap-6">
                <div className="text-slate-400 text-xs w-36 flex-shrink-0">
                  {new Date(g.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
                <div className="text-xs text-slate-300 w-20 flex-shrink-0">
                  {g.player_count} players
                </div>
                <div className="text-xs text-slate-400 w-24 flex-shrink-0">
                  {g.ai_mode}{g.ollama_model ? ` · ${g.ollama_model.replace(':latest', '')}` : ''}
                </div>
                <div className="text-xs text-slate-400 w-20 flex-shrink-0">
                  {g.round_count} round{g.round_count !== 1 ? 's' : ''}
                </div>
                <div className="flex-1 text-xs">
                  {g.tournament_winner
                    ? <span className="text-amber-300 font-semibold">🏆 {g.tournament_winner}</span>
                    : <span className="text-slate-500">In progress / abandoned</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

