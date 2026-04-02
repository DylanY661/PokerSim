export default function Card({ rank, suit, faceDown }) {
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const red  = suit === 'H' || suit === 'D';

  if (faceDown) {
    return (
      <div className="w-9 h-[52px] rounded-sm bg-zinc-800 border border-zinc-600/60 flex items-center justify-center shadow-sm">
        <div className="w-5 h-7 rounded-sm border border-zinc-600/40 bg-zinc-700/40" />
      </div>
    );
  }

  return (
    <div className={`w-9 h-[52px] rounded-sm bg-white border border-zinc-200 flex flex-col items-center justify-center shadow-sm ${red ? 'text-red-600' : 'text-zinc-800'}`}>
      <span className="text-sm font-black leading-none">{rank}</span>
      <span className="text-base leading-none">{SYM[suit] || suit}</span>
    </div>
  );
}
