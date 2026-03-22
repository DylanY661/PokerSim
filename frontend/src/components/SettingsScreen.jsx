import Toggle from './Toggle';
import SegmentGroup from './SegmentGroup';
import { PLAYER_NAMES, OLLAMA_MODELS, calcBlinds } from '../constants';

export default function SettingsScreen({ settings, browser, error, onStart, onHistory, onRestart }) {
  const {
    mode, setMode,
    ollamaModel, setOllamaModel,
    playerCount, setPlayerCount,
    startingStack, setStartingStack,
    actionSpeed, setActionSpeed,
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
            <h1 className="text-2xl font-bold text-white">Poker Simulator</h1>
            <p className="text-green-400 text-sm mt-0.5">AI-Powered Texas Hold'em</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="text-3xl tracking-widest opacity-70">♠ ♣ ♥ ♦</div>
            {connected ? (
              <span className="text-xs text-emerald-400 font-medium">● Engine connected</span>
            ) : (
              <button onClick={reconnect} className="text-xs text-amber-400 hover:text-amber-300 underline">
                ○ Engine offline — retry
              </button>
            )}
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-700">

          {/* Left column */}
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

            {/* Player Count */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Number of Players</p>
              <SegmentGroup options={[3, 4, 5]} value={playerCount} onChange={setPlayerCount} />
              <p className="text-slate-500 text-xs mt-1.5">{PLAYER_NAMES.slice(0, playerCount).join(', ')}</p>
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

          </div>

          <div className="px-8 py-6 space-y-5">

            {/* Browser Setup */}
            {mode === 'browser' && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Browser Setup</p>
                <div className="flex gap-2">
                  <button
                    onClick={init}
                    disabled={browserSufficient || initingBrowser || !connected}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50
                      ${browserSufficient
                        ? 'bg-violet-900 text-violet-200 cursor-default'
                        : 'bg-violet-600 hover:bg-violet-500 text-black'}`}
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
                      className="px-3 py-2.5 rounded-lg bg-red-900 hover:bg-red-800 disabled:opacity-40 text-sm font-medium text-red-200 transition-colors"
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
                      className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                      {confirmingLogin ? '⏳ Saving session…' : '✓ I\'m Done Signing In'}
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
                            className="text-black hover:text-black text-xs px-2 py-1 rounded border border-violet-800 hover:border-violet-600 transition-colors"
                          >
                            Sign In
                          </button>
                        )}
                        <button
                          onClick={checkSession}
                          className="text-black hover:text-black text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors"
                        >
                          ↺
                        </button>
                        {sessionStatus === true && (
                          <button
                            onClick={clearSession}
                            disabled={clearingSession}
                            className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded border border-red-900 hover:border-red-700 transition-colors disabled:opacity-40"
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

            {/* Action Speed */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Action Speed</p>
              <SegmentGroup
                options={[0, 1000, 2500]}
                value={actionSpeed}
                onChange={setActionSpeed}
                labelFn={v => v === 0 ? '⚡ Fast' : v === 1000 ? '▶ Normal' : '🐢 Slow'}
              />
              <p className="text-slate-500 text-xs mt-1.5">Delay between each AI action</p>
            </div>

            {/* Show Hands */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-slate-300 text-sm font-medium">Show all player hands</p>
                <p className="text-slate-500 text-xs">Reveal face-down cards during the game</p>
              </div>
              <Toggle value={showHands} onChange={setShowHands} />
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
            className="flex-1 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg transition-colors"
          >
            ▶ Start Game
          </button>
          <button
            onClick={onHistory}
            className="px-4 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-black text-sm font-medium transition-colors whitespace-nowrap"
          >
            History
          </button>
          {(browserReady || connected) && (
            <button
              onClick={onRestart}
              disabled={shuttingDown}
              className="px-5 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-black text-sm font-medium transition-colors whitespace-nowrap"
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
