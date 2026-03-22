export const PLAYER_NAMES = ['Calculator', 'Shark', 'Gambler', 'Maniac', 'Rock'];

// Used only for the settings screen blind preview — game logic uses backend
export const calcBlinds = (stack) => {
  const sb = Math.max(1, Math.round(stack * 0.01));
  return { SB: sb, BB: sb * 2 };
};

export const SEAT_POSITIONS = {
  3: [
    { bottom: 0,      left: '50%',   transform: 'translateX(-50%)' },
    { top: '5%',      right: '8%' },
    { top: '5%',      left: '8%' },
  ],
  4: [
    { bottom: 0,      left: '50%',   transform: 'translateX(-50%)' },
    { right: '3%',    top: '50%',    transform: 'translateY(-50%)' },
    { top: '5%',      left: '50%',   transform: 'translateX(-50%)' },
    { left: '3%',     top: '50%',    transform: 'translateY(-50%)' },
  ],
  5: [
    { bottom: 0,      left: '50%',   transform: 'translateX(-50%)' },
    { right: '3%',    bottom: '22%', transform: 'translateY(50%)' },
    { top: '5%',      right: '8%' },
    { top: '5%',      left: '8%' },
    { left: '3%',     bottom: '22%', transform: 'translateY(50%)' },
  ],
};

export const ACTION_TEXT = {
  fold:   'text-red-400',
  call:   'text-yellow-400',
  raise:  'text-green-400',
  blind:  'text-slate-400',
  wins:   'text-amber-300',
  result: 'text-amber-300',
  error:  'text-orange-400',
  bust:   'text-slate-400',
};

export const ACTION_BADGE = {
  fold:  'bg-red-900/60 border-red-500/40',
  call:  'bg-yellow-900/60 border-yellow-500/40',
  raise: 'bg-green-900/60 border-green-500/40',
};

export const ACTION_ROW = {
  fold:   'bg-red-950/40 border-red-800/40',
  call:   'bg-yellow-950/40 border-yellow-800/40',
  raise:  'bg-green-950/40 border-green-800/40',
  blind:  'bg-slate-800/60 border-slate-700',
  wins:   'bg-amber-950/40 border-amber-700/40',
  result: 'bg-amber-950/40 border-amber-700/40',
  error:  'bg-orange-950/40 border-orange-800/40',
  bust:   'bg-slate-800/60 border-slate-700',
};

export const OLLAMA_MODELS = [
  'llama3.2:latest',
  'qwen3.5:latest',
];

export const STREET_LABEL = {
  preflop: 'Pre-Flop',
  flop:    'Flop',
  turn:    'Turn',
  river:   'River',
};

export function parseErrorMsg(e) {
  const raw = e.response?.data?.detail || e.message || 'Request failed';
  if (/connection refused|econnrefused|failed to fetch/i.test(raw)) return 'Cannot reach backend — is it running?';
  if (/ollama/i.test(raw) && /error|refused|connect/i.test(raw))    return 'Ollama not reachable — is it running?';
  if (/api.?key|gemini_api/i.test(raw))                             return 'Gemini API key missing or invalid.';
  if (/browser not initialized/i.test(raw))                         return 'Browser not initialized — click Init Browser first.';
  if (/rate.?limit|429/i.test(raw))                                 return 'Rate limit hit — try a slower action speed.';
  return raw;
}
