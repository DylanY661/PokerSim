import Card from './Card';
import { ACTION_TEXT, ACTION_BADGE } from '../constants';

export default function Seat({ name, stack, cards, isDealer, isSmallBlind, isBigBlind, isActive, isThinking, lastAction, isFolded, isAllIn, onRevealToggle, style }) {
  return (
    <div
      className={`absolute flex flex-col items-center rounded-xl px-2 py-1.5 min-w-[88px] transition-all border
        ${isFolded
          ? 'bg-slate-900/60 border-slate-700/40 opacity-40'
          : isActive
            ? 'bg-slate-800/90 ring-2 ring-amber-400 ring-offset-1 ring-offset-green-900 border-amber-400/70'
            : 'bg-slate-800/90 border-slate-600/70'}`}
      style={style}
    >
      <span className={`font-semibold text-xs leading-tight ${isFolded ? 'text-slate-500' : 'text-white'}`}>{name}</span>
      <span className="text-amber-300 text-xs leading-tight">${stack.toLocaleString()}</span>

      {isThinking && (
        <span className="text-slate-400 text-[10px] animate-pulse mt-0.5">thinking…</span>
      )}
      {isFolded && (
        <span className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">Folded</span>
      )}
      {!isFolded && isAllIn && (
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border mt-0.5 bg-purple-900/60 border-purple-500/40 text-purple-300">
          All In
        </span>
      )}
      {!isFolded && !isThinking && !isAllIn && lastAction && lastAction.action !== 'blind' && (
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border mt-0.5
          ${ACTION_BADGE[lastAction.action] || 'bg-slate-700 border-slate-600'}
          ${ACTION_TEXT[lastAction.action]  || 'text-white'}`}>
          {lastAction.action === 'call' && lastAction.amount === 0
            ? 'Check'
            : `${lastAction.action}${lastAction.amount > 0 ? ` $${lastAction.amount.toLocaleString()}` : ''}`}
        </span>
      )}

      <div
        className={`flex gap-0.5 mt-1 rounded ${onRevealToggle ? 'cursor-pointer hover:ring-1 hover:ring-slate-400/50' : ''}`}
        onClick={onRevealToggle ?? undefined}
      >
        {cards?.map((c, i) => <Card key={i} {...c} />)}
      </div>

      {isDealer && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-slate-800 text-[10px] flex items-center justify-center font-bold shadow">
          D
        </span>
      )}
      {!isDealer && isSmallBlind && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold shadow">
          SB
        </span>
      )}
      {!isDealer && !isSmallBlind && isBigBlind && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold shadow">
          BB
        </span>
      )}
    </div>
  );
}
