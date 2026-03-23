import { useState, useRef } from 'react';
import { createGame, startNextRound, stopGame, listGames } from '../api';
import { useSettings } from '../hooks/useSettings';
import { useBrowser } from '../hooks/useBrowser';
import { useGameSocket } from '../hooks/useGameSocket';
import { useAuth } from '../hooks/useAuth';
import { PLAYER_NAMES, SEAT_POSITIONS, STREET_LABEL, parseErrorMsg } from '../constants';
import SettingsScreen from './SettingsScreen';
import HistoryScreen from './HistoryScreen';
import AuthModal from './AuthModal';
import GameTable from './GameTable';
import GameLog from './GameLog';

export default function PokerTable() {
  const [phase, setPhase]           = useState('settings');
  const [error, setError]           = useState(null);
  const [games, setGames]           = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [playAsHuman, setPlayAsHuman]     = useState(false);
  const [raiseAmount, setRaiseAmount]     = useState('');
  const gameIdRef = useRef(null);

  const auth     = useAuth();
  const settings = useSettings();
  const browser  = useBrowser({ playerCount: settings.playerCount, mode: settings.mode, onError: setError });
  const game     = useGameSocket(setError);

  // Clear playAsHuman if user logs out
  const handleLogout = () => { auth.logout(); setPlayAsHuman(false); };

  // ── Game handlers ───────────────────────────────────────────────────────────

  const _teardown = async () => {
    game.disconnect();
    if (gameIdRef.current) {
      try { await stopGame(gameIdRef.current); } catch { /* ignore */ }
      gameIdRef.current = null;
    }
    await browser.shutdown();
    game.resetGameState();
  };

  const handleEndGame = async () => {
    await _teardown();
    setPhase('settings');
  };

  const handleRestart = async () => {
    await _teardown();
    browser.resetSession();
  };

  const handleRunGame = async () => {
    setError(null);
    try {
      const { game_id } = await createGame({
        playerCount:   settings.playerCount,
        startingStack: settings.startingStack,
        aiMode:        settings.mode,
        ollamaModel:   settings.mode === 'ollama' ? settings.ollamaModel : null,
        actionSpeed:   1000,
        humanPlayer:   (playAsHuman && auth.user) ? auth.user.username : null,
        token:         auth.token,
      });
      gameIdRef.current = game_id;
      await game.connect(game_id);
      await startNextRound(game_id);
    } catch (e) {
      setError(parseErrorMsg(e));
    }
  };

  const handleNextRound = async () => {
    if (!gameIdRef.current) return;
    setError(null);
    try { await startNextRound(gameIdRef.current); }
    catch (e) { setError(parseErrorMsg(e)); }
  };

  const handleOpenHistory = async () => {
    setPhase('history');
    if (!auth.user) return;
    setLoadingGames(true);
    try { setGames(await listGames(auth.token)); }
    catch { /* ignore */ }
    finally { setLoadingGames(false); }
  };

  // ── Phase routing ───────────────────────────────────────────────────────────

  if (phase === 'history') {
    return (
      <>
        <HistoryScreen
          games={games}
          loading={loadingGames}
          onBack={() => setPhase('settings')}
          isAuthenticated={!!auth.user}
          onShowAuth={() => setShowAuthModal(true)}
        />
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onLogin={auth.login}
            onRegister={auth.register}
          />
        )}
      </>
    );
  }

  if (phase === 'settings') {
    return (
      <>
        <SettingsScreen
          settings={settings}
          browser={browser}
          error={error}
          onStart={() => { game.resetGameState(); setError(null); setPhase('game'); }}
          onHistory={handleOpenHistory}
          onRestart={handleRestart}
          auth={{ user: auth.user, logout: handleLogout }}
          playAsHuman={playAsHuman}
          onTogglePlayAsHuman={setPlayAsHuman}
          onShowAuth={() => setShowAuthModal(true)}
        />
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onLogin={auth.login}
            onRegister={auth.register}
          />
        )}
      </>
    );
  }

  // ── Game phase ──────────────────────────────────────────────────────────────

  const { playerCount, startingStack, mode, showHands, setShowHands } = settings;
  const humanName     = (playAsHuman && auth.user) ? auth.user.username : null;
  const activePlayers = game.players.length
    ? game.players
    : humanName
      ? [humanName, ...PLAYER_NAMES.filter(n => n !== humanName).slice(0, playerCount - 1)]
      : PLAYER_NAMES.slice(0, playerCount);
  const seatPos       = SEAT_POSITIONS[playerCount];

  const seats = activePlayers.map((name, i) => {
    const isHuman = name === humanName;
    return {
      name,
      stack:        game.stacks[name] ?? startingStack,
      cards:        (showHands || isHuman)
                      ? (game.holeCards[name] ?? [{ faceDown: true }, { faceDown: true }])
                      : (name === activePlayers[0]
                          ? (game.holeCards[name] ?? [{ faceDown: true }, { faceDown: true }])
                          : [{ faceDown: true }, { faceDown: true }]),
      isDealer:     name === game.dealerName,
      isSmallBlind: name === game.sbName,
      isBigBlind:   name === game.bbName,
      isActive:     name === game.activePlayer || (isHuman && !!game.humanActionRequired),
      isThinking:   (name === game.activePlayer && game.gameRunning) || (isHuman && !!game.humanActionRequired),
      lastAction:   game.playerActions[name] ?? null,
      isFolded:     game.foldedPlayers.has(name),
      isAllIn:      game.allInPlayers.has(name),
      isHuman,
      style:        seatPos[i],
    };
  });

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
        <button
          onClick={() => setPhase('settings')}
          disabled={game.gameRunning}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 text-sm text-black"
        >
          ← Settings
        </button>
        <span className="text-slate-400 text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700">
          {mode === 'browser' ? 'Browser' : mode === 'api' ? 'API' : 'Ollama'}
        </span>
        {game.roundNumber > 0 && (
          <span className="text-slate-400 text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700">
            Round {game.roundNumber}
          </span>
        )}
        {game.gameRunning && (
          <span className="text-amber-400 text-xs px-2 py-1 rounded bg-amber-950/40 border border-amber-700/40">
            {STREET_LABEL[game.street] ?? game.street}
          </span>
        )}
        {error && <span className="text-red-400 text-xs ml-2">⚠ {error}</span>}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowHands(h => !h)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-sm text-black"
          >
            {showHands ? 'Hide Hands' : 'Show Hands'}
          </button>

          <button
            onClick={handleEndGame}
            disabled={browser.shuttingDown}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 text-sm font-medium text-black"
          >
            {browser.shuttingDown ? 'Ending…' : 'End Game'}
          </button>

          {game.gameRunning ? (
            <button
              onClick={game.sendStop}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-gray-100 font-semibold text-sm text-black"
            >
              ⏹ Stop
            </button>
          ) : game.roundComplete ? (
            <button
              onClick={handleNextRound}
              disabled={!!game.tournamentWinner}
              className={`px-4 py-1.5 rounded-lg font-semibold text-sm text-black ${game.tournamentWinner ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-gray-100'}`}
            >
              {game.tournamentWinner ? 'Tournament Over' : 'Next Round'}
            </button>
          ) : (
            <button
              onClick={handleRunGame}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-gray-100 font-semibold text-sm text-black"
            >
              ▶ Run Game
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <GameTable
          seats={seats}
          communityCards={game.communityCards}
          pot={game.pot}
          lastWinner={game.lastWinner}
          gameRunning={game.gameRunning}
          tournamentWinner={game.tournamentWinner}
        />
        <GameLog gameLog={game.gameLog} />
      </div>

      {/* Human action panel */}
      {game.humanActionRequired && (
        <div className="flex-shrink-0 bg-slate-800/95 border-t border-amber-600/50 px-4 py-3 flex items-center gap-3">
          <span className="text-amber-400 text-sm font-semibold">Your turn</span>
          <span className="text-slate-400 text-xs">
            To call: ${game.humanActionRequired.toCall} &nbsp;·&nbsp; Stack: ${game.humanActionRequired.stack} &nbsp;·&nbsp; Pot: ${game.humanActionRequired.pot}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => game.sendHumanAction('fold')}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-sm font-medium text-black transition-colors"
            >
              Fold
            </button>
            <button
              onClick={() => game.sendHumanAction('call')}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-sm font-medium text-black transition-colors"
            >
              {game.humanActionRequired.toCall === 0 ? 'Check' : `Call $${game.humanActionRequired.toCall}`}
            </button>
            <input
              type="number"
              min={game.humanActionRequired.minRaise}
              max={game.humanActionRequired.stack}
              value={raiseAmount}
              onChange={e => setRaiseAmount(e.target.value)}
              placeholder={`Raise (min $${game.humanActionRequired.minRaise})`}
              className="w-36 bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              onClick={() => {
                const amt = parseInt(raiseAmount, 10);
                if (amt >= game.humanActionRequired.minRaise) {
                  game.sendHumanAction('raise', amt);
                  setRaiseAmount('');
                }
              }}
              disabled={!raiseAmount || parseInt(raiseAmount, 10) < game.humanActionRequired.minRaise}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 text-sm font-medium text-black transition-colors"
            >
              Raise
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
