import { useState, useRef } from 'react';
import { createGame, startNextRound, stopGame, listGames } from '../api';
import { useSettings } from '../hooks/useSettings';
import { useBrowser } from '../hooks/useBrowser';
import { useGameSocket } from '../hooks/useGameSocket';
import { PLAYER_NAMES, SEAT_POSITIONS, STREET_LABEL, parseErrorMsg } from '../constants';
import SettingsScreen from './SettingsScreen';
import HistoryScreen from './HistoryScreen';
import GameTable from './GameTable';
import GameLog from './GameLog';

export default function PokerTable() {
  const [phase, setPhase]           = useState('settings');
  const [error, setError]           = useState(null);
  const [games, setGames]           = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const gameIdRef = useRef(null);

  const settings = useSettings();
  const browser  = useBrowser({ playerCount: settings.playerCount, mode: settings.mode, onError: setError });
  const game     = useGameSocket(setError);

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
        actionSpeed:   settings.actionSpeed,
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
    setLoadingGames(true);
    try { setGames(await listGames()); }
    catch { /* ignore */ }
    finally { setLoadingGames(false); }
  };

  // ── Phase routing ───────────────────────────────────────────────────────────

  if (phase === 'history') {
    return (
      <HistoryScreen
        games={games}
        loading={loadingGames}
        onBack={() => setPhase('settings')}
      />
    );
  }

  if (phase === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        browser={browser}
        error={error}
        onStart={() => { game.resetGameState(); setError(null); setPhase('game'); }}
        onHistory={handleOpenHistory}
        onRestart={handleRestart}
      />
    );
  }

  // ── Game phase ──────────────────────────────────────────────────────────────

  const { playerCount, startingStack, mode, showHands, setShowHands } = settings;
  const activePlayers = PLAYER_NAMES.slice(0, playerCount);
  const seatPos       = SEAT_POSITIONS[playerCount];

  const seats = activePlayers.map((name, i) => ({
    name,
    stack:        game.stacks[name] ?? startingStack,
    cards:        showHands
                    ? (game.holeCards[name] ?? [{ faceDown: true }, { faceDown: true }])
                    : (name === activePlayers[0]
                        ? (game.holeCards[name] ?? [{ faceDown: true }, { faceDown: true }])
                        : [{ faceDown: true }, { faceDown: true }]),
    isDealer:     name === game.dealerName,
    isSmallBlind: name === game.sbName,
    isBigBlind:   name === game.bbName,
    isActive:     name === game.activePlayer,
    isThinking:   name === game.activePlayer && game.gameRunning,
    lastAction:   game.playerActions[name] ?? null,
    isFolded:     game.foldedPlayers.has(name),
    isAllIn:      game.allInPlayers.has(name),
    style:        seatPos[i],
  }));

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-slate-800/80 flex-shrink-0">
        <button
          onClick={() => setPhase('settings')}
          disabled={game.gameRunning}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-sm text-black"
        >
          ← Settings
        </button>
        <span className="text-slate-400 text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700">
          {mode === 'browser' ? '🌐 Browser' : mode === 'api' ? '⚡ API' : '🦙 Ollama'}
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
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-black"
          >
            {showHands ? '🙈 Hide Hands' : '👁 Show Hands'}
          </button>

          <button
            onClick={handleEndGame}
            disabled={browser.shuttingDown}
            className="px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 disabled:opacity-40 text-sm font-medium text-black"
          >
            {browser.shuttingDown ? 'Ending…' : '⏹ End Game'}
          </button>

          {game.gameRunning ? (
            <button
              onClick={game.sendStop}
              className="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 font-semibold text-sm text-black"
            >
              ⏹ Stop
            </button>
          ) : game.roundComplete ? (
            <button
              onClick={handleNextRound}
              disabled={!!game.tournamentWinner}
              className={`px-4 py-1.5 rounded-lg font-semibold text-sm text-black ${game.tournamentWinner ? 'bg-slate-600 opacity-50 cursor-not-allowed' : 'bg-green-700 hover:bg-green-600'}`}
            >
              {game.tournamentWinner ? '🏆 Tournament Over' : '▶ Next Round'}
            </button>
          ) : (
            <button
              onClick={handleRunGame}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-semibold text-sm text-black"
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

    </div>
  );
}
