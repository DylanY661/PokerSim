import { useState, useEffect } from 'react';

export function useSettings() {
  const [mode, setMode]               = useState(() => localStorage.getItem('pk_mode') || 'ollama');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('pk_ollama_model') || 'llama3.2:latest');
  const [playerCount, setPlayerCount] = useState(() => parseInt(localStorage.getItem('pk_players') || '3'));
  const [startingStack, setStartingStack] = useState(() => parseInt(localStorage.getItem('pk_stack') || '1000'));
  const [actionSpeed, setActionSpeed] = useState(() => parseInt(localStorage.getItem('pk_speed') ?? '1000'));
  const [showHands, setShowHands]     = useState(() => localStorage.getItem('pk_showHands') === 'true');

  useEffect(() => { localStorage.setItem('pk_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('pk_ollama_model', ollamaModel); }, [ollamaModel]);
  useEffect(() => { localStorage.setItem('pk_players', playerCount); }, [playerCount]);
  useEffect(() => { localStorage.setItem('pk_stack', startingStack); }, [startingStack]);
  useEffect(() => { localStorage.setItem('pk_speed', actionSpeed); }, [actionSpeed]);
  useEffect(() => { localStorage.setItem('pk_showHands', showHands); }, [showHands]);

  return {
    mode, setMode,
    ollamaModel, setOllamaModel,
    playerCount, setPlayerCount,
    startingStack, setStartingStack,
    actionSpeed, setActionSpeed,
    showHands, setShowHands,
  };
}
