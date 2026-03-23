import Toggle from './Toggle';
import SegmentGroup from './SegmentGroup';
import { OLLAMA_MODELS, calcBlinds } from '../constants';

export default function SettingsScreen({ settings, browser, error, onStart, onHistory, onRestart, auth, playAsHuman, onTogglePlayAsHuman, onShowAuth }) {
  const {
    mode, setMode,
    ollamaModel, setOllamaModel,
    playerCount, setPlayerCount,
    startingStack, setStartingStack,
    showHands, setShowHands,
  } = settings;

  const {
    connected, browserReady, initingBrowser, initializedCount,
    shuttingDown, sessionStatus, clearingSession, signingIn, confirmingLogin,
    reconnect, init, stop, checkSession, clearSession, startLogin, confirmLogin,
  } = browser;

  const browserSufficient = browserReady && initializedCount >= playerCount;
  const needsMoreTabs     = browserReady && initializedCount < playerCount;
  const canStart = connected && (mode === 'api' || mode === 'ollama' || browserSufficient);
  const { SB: sb, BB: bb } = calcBlinds(startingStack);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-green-900 to-green-950 px-10 py-5 flex items-center justify-between border-b border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-white">Poker Showdown</h1>
            <p className="text-green-400 text-sm mt-0.5">AI-Powered Texas Hold'em</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="text-3xl tracking-widest opacity-70">♠ ♣ ♥ ♦</div>
            {connected ? (
              <span className="text-xs text-emerald-400 font-medium">● Engine connected</span>
            ) : (
              <button onClick={reconnect} className="text-xs text-black hover:text-gray-700 underline">
                ○ Engine offline — retry
              </button>
            )}
            {auth?.user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">👤 {auth.user.username}</span>
                <button
                  onClick={auth.logout}
                  className="text-xs text-black hover:text-gray-700 underline"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={onShowAuth}
                className="text-xs text-black hover:text-gray-700 underline"
              >
                Sign in / Register
              </button>
            )}
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-700">

          {/* Left column — AI settings */}
          <div className="px-8 py-6 space-y-5">

            {/* AI Mode */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">AI Mode</p>
              <SegmentGroup
                options={['ollama', 'browser', 'api']}
                value={mode}
                onChange={setMode}
                labelFn={m => m === 'browser' ? '🌐 Browser' : m === 'api' ? '⚡ API' : '🦙 Ollama'}
              />
              <p className="text-slate-500 text-xs mt-1.5">
                {mode === 'browser'
                  ? 'Uses Gemini via Chrome — bypasses API rate limits'
                  : mode === 'api'
                    ? 'Uses Gemini API directly — requires GEMINI_API_KEY in .env'
                    : 'Uses a local Ollama model — requires OLLAMA_URL in .env'}
              </p>
            </div>

            {/* Ollama Model */}
            {mode === 'ollama' && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Ollama Model</p>
                <div className="flex gap-2 items-center">
                  <select
                    value={OLLAMA_MODELS.includes(ollamaModel) ? ollamaModel : 'custom'}
                    onChange={e => { if (e.target.value !== 'custom') setOllamaModel(e.target.value); }}
                    className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {OLLAMA_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    {!OLLAMA_MODELS.includes(ollamaModel) && <option value="custom">{ollamaModel}</option>}
                  </select>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={e => setOllamaModel(e.target.value)}
                    placeholder="or type a model name"
                    className="flex-1 bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Browser Setup */}
            {mode === 'browser' && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Browser Setup</p>
                <div className="flex gap-2">
                  <button
                    onClick={init}
                    disabled={browserSufficient || initingBrowser || !connected}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm text-black transition-colors disabled:opacity-50
                      ${browserSufficient
                        ? 'bg-gray-200 cursor-default'
                        : 'bg-white hover:bg-gray-100'}`}
                  >
                    {initingBrowser
                      ? '⏳ Initializing…'
                      : browserSufficient
                        ? `✓ Ready (${initializedCount} tabs)`
                        : needsMoreTabs
                          ? `Add ${playerCount - initializedCount} More Tab${playerCount - initializedCount > 1 ? 's' : ''}`
                          : 'Initialize Browser'}
                  </button>
                  {browserReady && (
                    <button
                      onClick={stop}
                      disabled={shuttingDown}
                      className="px-3 py-2.5 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 text-sm font-medium text-black transition-colors"
                    >
                      {shuttingDown ? '…' : '⏹ Stop'}
                    </button>
                  )}
                </div>
                {!browserSufficient && !initingBrowser && (
                  <p className="text-slate-500 text-xs mt-1.5">
                    {needsMoreTabs
                      ? `${initializedCount} tabs open — need ${playerCount} for this game`
                      : `Opens ${playerCount} Chrome tab${playerCount > 1 ? 's' : ''} and sends personality prompts`}
                  </p>
                )}
              </div>
            )}

            {/* Gemini Account — browser mode only */}
            {mode === 'browser' && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Gemini Account</p>

                {signingIn ? (
                  <div className="space-y-2">
                    <p className="text-amber-300 text-xs leading-relaxed">
                      Chrome is open — sign into your Google account on the Gemini page, then click below.
                    </p>
                    <button
                      onClick={confirmLogin}
                      disabled={confirmingLogin}
                      className="w-full py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 text-black text-sm font-medium transition-colors"
                    >
                      {confirmingLogin ? 'Saving session…' : '✓ I\'m Done Signing In'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {sessionStatus === null && connected && (
                      <p className="text-slate-500 text-xs flex-1">Checking session…</p>
                    )}
                    {sessionStatus === true && (
                      <p className="flex-1 text-emerald-400 text-xs font-medium">✓ Signed in — session saved</p>
                    )}
                    {(sessionStatus === false || (!connected && sessionStatus === null)) && (
                      <p className="flex-1 text-slate-400 text-xs">Not signed in</p>
                    )}
                    {connected && (
                      <>
                        {sessionStatus !== true && (
                          <button
                            onClick={startLogin}
                            className="text-black text-xs px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors"
                          >
                            Sign In
                          </button>
                        )}
                        <button
                          onClick={checkSession}
                          className="text-black text-xs px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors"
                        >
                          ↺
                        </button>
                        {sessionStatus === true && (
                          <button
                            onClick={clearSession}
                            disabled={clearingSession}
                            className="text-black text-xs px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-40"
                          >
                            {clearingSession ? '…' : 'Clear'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <p className="text-slate-600 text-xs mt-1.5">
                  Sign in to use a saved Google session. Or skip and sign in manually inside each browser tab.
                </p>
              </div>
            )}

          </div>

          {/* Right column — Game settings */}
          <div className="px-8 py-6 space-y-5">

            {/* Player Count */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Number of Players</p>
              <SegmentGroup options={[3, 4, 5]} value={playerCount} onChange={setPlayerCount} />
            </div>

            {/* Starting Stack */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Starting Stack</p>
              <SegmentGroup
                options={[500, 1000, 2000]}
                value={startingStack}
                onChange={setStartingStack}
                labelFn={n => `$${n}`}
              />
              <p className="text-slate-500 text-xs mt-1.5">
                Blinds: ${sb} / ${bb} &nbsp;·&nbsp; {Math.floor(startingStack / bb)} big blinds each
              </p>
            </div>

            {/* Show Hands */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-slate-300 text-sm font-medium">Show all player hands</p>
                <p className="text-slate-500 text-xs">Reveal face-down cards during the game</p>
              </div>
              <Toggle value={showHands} onChange={setShowHands} />
            </div>

            {/* Play as Human */}
            <div className={`flex items-center justify-between py-1 ${!auth?.user ? 'opacity-40' : ''}`}>
              <div>
                <p className="text-slate-300 text-sm font-medium">
                  {auth?.user ? `Play as ${auth.user.username}` : 'Play as Human'}
                </p>
                <p className="text-slate-500 text-xs">
                  {auth?.user ? 'Join the game as a human player' : 'Sign in to play as a human'}
                </p>
              </div>
              <Toggle value={playAsHuman} onChange={onTogglePlayAsHuman} disabled={!auth?.user} />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

          </div>
        </div>

        {/* Bottom action bar */}
        <div className="px-8 pb-6 pt-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onStart}
            disabled={!canStart}
            className="flex-1 py-3.5 rounded-xl bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg text-black transition-colors"
          >
            ▶ Start Game
          </button>
          <button
            onClick={onHistory}
            className="px-4 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-black text-sm font-medium transition-colors whitespace-nowrap"
          >
            History
          </button>
          {(browserReady || connected) && (
            <button
              onClick={onRestart}
              disabled={shuttingDown}
              className="px-5 py-3.5 rounded-xl bg-white hover:bg-gray-100 disabled:opacity-40 text-black text-sm font-medium transition-colors whitespace-nowrap"
            >
              {shuttingDown ? 'Restarting…' : 'Restart'}
            </button>
          )}
        </div>
        {!canStart && (
          <p className="text-slate-500 text-xs text-center pb-4">
            {!connected
              ? 'Connect to the engine first'
              : needsMoreTabs
                ? `Add ${playerCount - initializedCount} more browser tab${playerCount - initializedCount > 1 ? 's' : ''} first`
                : 'Initialize the browser first'}
          </p>
        )}
      </div>
    </div>
  );
}
