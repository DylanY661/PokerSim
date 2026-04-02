import { ACTION_TEXT, ACTION_ROW } from '../constants';

export default function GameLog({ gameLog }) {
  return (
    <div className="w-80 flex-shrink-0 border-l border-[#162538] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#162538] flex-shrink-0">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Round Actions</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {gameLog.length === 0 && (
          <p className="text-slate-600 text-xs text-center mt-8">No actions yet — press Run Game to start.</p>
        )}
        {gameLog.map((entry, i) => (
          <div
            key={i}
            className={`flex gap-2.5 pl-2 pr-3 py-2 rounded-sm border border-[#162538] border-l-2 text-sm bg-[#0d1e30]/60
              ${ACTION_ROW[entry.action] || 'border-l-slate-600'}`}
          >
            <div className="flex-shrink-0 min-w-[68px]">
              <p className="text-slate-200 font-semibold text-xs leading-tight">{entry.player}</p>
              <p className={`font-bold uppercase text-xs leading-tight ${ACTION_TEXT[entry.action] || 'text-slate-400'}`}>
                {entry.action}{entry.amount > 0 ? ` $${entry.amount}` : ''}
              </p>
              {entry.street && (
                <p className="text-slate-600 text-[9px] uppercase tracking-wide">{entry.street}</p>
              )}
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">{entry.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
