export default function Card({ rank, suit, faceDown }) {
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const red  = suit === 'H' || suit === 'D';

  if (faceDown) {
    return (
      <div className="w-8 h-11 rounded bg-slate-700 border border-slate-500 flex items-center justify-center text-slate-400 text-[10px]">
        ?
      </div>
    );
  }

  return (
    <div className={`w-8 h-11 rounded bg-white border border-slate-300 flex flex-col items-center justify-center text-[10px] shadow-md ${red ? 'text-red-600' : 'text-slate-800'}`}>
      <span className="font-bold leading-none">{rank}</span>
      <span className="leading-none">{SYM[suit] || suit}</span>
    </div>
  );
}
