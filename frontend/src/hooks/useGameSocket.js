import { useState, useRef, useCallback } from 'react';
import { openGameSocket } from '../api';

export function useGameSocket(onError) {
  const [holeCards, setHoleCards]           = useState({});
  const [dealerName, setDealerName]         = useState(null);
  const [sbName, setSbName]                 = useState(null);
  const [bbName, setBbName]                 = useState(null);
  const [roundNumber, setRoundNumber]       = useState(0);
  const [communityCards, setCommunityCards] = useState([]);
  const [street, setStreet]                 = useState('preflop');
  const [activePlayer, setActivePlayer]     = useState(null);
  const [playerActions, setPlayerActions]   = useState({});
  const [stacks, setStacks]                 = useState({});
  const [pot, setPot]                       = useState(0);
  const [foldedPlayers, setFoldedPlayers]   = useState(new Set());
  const [allInPlayers, setAllInPlayers]     = useState(new Set());
  const [gameLog, setGameLog]               = useState([]);
  const [gameRunning, setGameRunning]       = useState(false);
  const [roundComplete, setRoundComplete]   = useState(false);
  const [lastWinner, setLastWinner]         = useState(null);
  const [tournamentWinner, setTournamentWinner] = useState(null);
  const [humanActionRequired, setHumanActionRequired] = useState(null);
  const [players, setPlayers]                         = useState([]);

  const wsRef = useRef(null);

  const handleWsEvent = useCallback((event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'deal':
        if (data.players?.length) setPlayers(data.players);
        setHoleCards(data.hole_cards ?? {});
        setDealerName(data.dealer);
        setSbName(data.sb);
        setBbName(data.bb);
        setRoundNumber(data.round_number);
        setCommunityCards([]);
        setGameLog([]);
        setPlayerActions({});
        setFoldedPlayers(new Set());
        setAllInPlayers(new Set());
        setGameRunning(true);
        setRoundComplete(false);
        setLastWinner(null);
        break;
      case 'street':
        setCommunityCards(data.community_cards ?? []);
        setStreet(data.street);
        setPlayerActions({});
        break;
      case 'thinking':
        setActivePlayer(data.player);
        break;
      case 'action_required':
        setHumanActionRequired({
          toCall:       data.to_call,
          pot:          data.pot,
          stack:        data.stack,
          minRaise:     data.min_raise,
          validActions: data.valid_actions,
        });
        break;
      case 'action':
        setHumanActionRequired(null);
        setActivePlayer(null);
        setStacks(data.stacks ?? {});
        setPot(data.pot ?? 0);
        setFoldedPlayers(new Set(data.folded ?? []));
        setAllInPlayers(new Set(data.all_in ?? []));
        setPlayerActions(prev => ({ ...prev, [data.player]: { action: data.action, amount: data.amount } }));
        setGameLog(prev => [...prev, {
          player: data.player, street: data.street, action: data.action,
          amount: data.amount, reasoning: data.reasoning,
        }]);
        break;
      case 'round_end':
        setStacks(data.stacks ?? {});
        setPot(0);
        setLastWinner({ name: data.winner, amount: data.pot, handName: data.hand });
        setActivePlayer(null);
        setGameRunning(false);
        setRoundComplete(true);
        if (data.hole_cards) setHoleCards(data.hole_cards);
        if (data.busted?.length) {
          setGameLog(prev => [
            ...prev,
            ...data.busted.map(p => ({
              player: p, street: 'result', action: 'bust', amount: 0,
              reasoning: 'Eliminated — out of chips.',
            })),
          ]);
        }
        break;
      case 'game_end':
        setTournamentWinner(data.champion);
        break;
      case 'error':
        onError(data.message);
        break;
    }
  }, [onError]);

  const connect = (gameId) => new Promise((resolve, reject) => {
    const ws = openGameSocket(gameId);
    ws.onmessage = handleWsEvent;
    ws.onerror   = () => reject(new Error('WebSocket connection failed'));
    ws.onclose   = () => { wsRef.current = null; };
    ws.onopen    = () => { wsRef.current = ws; resolve(ws); };
  });

  const disconnect = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  };

  const sendStop = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
  };

  const sendHumanAction = (action, amount = 0) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'human_action', action, amount }));
  };

  const resetGameState = () => {
    setHoleCards({});
    setDealerName(null);
    setSbName(null);
    setBbName(null);
    setRoundNumber(0);
    setCommunityCards([]);
    setStreet('preflop');
    setActivePlayer(null);
    setPlayerActions({});
    setStacks({});
    setPot(0);
    setFoldedPlayers(new Set());
    setAllInPlayers(new Set());
    setGameLog([]);
    setGameRunning(false);
    setRoundComplete(false);
    setLastWinner(null);
    setTournamentWinner(null);
    setHumanActionRequired(null);
    setPlayers([]);
  };

  return {
    players,
    holeCards, dealerName, sbName, bbName, roundNumber,
    communityCards, street,
    activePlayer, playerActions,
    stacks, pot,
    foldedPlayers, allInPlayers,
    gameLog,
    gameRunning, roundComplete,
    lastWinner, tournamentWinner,
    humanActionRequired,
    wsRef,
    connect, disconnect, sendStop, sendHumanAction, resetGameState,
  };
}
