import Card from './Card';
import Seat from './Seat';

export default function GameTable({ seats, communityCards, pot, lastWinner, gameRunning, tournamentWinner }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-4 min-w-0">

      {/* Winner banner */}
      {lastWinner && !gameRunning && (
        <div className={`w-full max-w-xl px-5 py-3 rounded-md border text-center flex-shrink-0 shadow-sm ${
          tournamentWinner
            ? 'bg-zinc-900/80 border-green-500/60'
            : 'bg-zinc-900/80 border-amber-500/60'
        }`}>
          <p className={`font-bold text-lg ${tournamentWinner ? 'text-green-300' : 'text-amber-300'}`}>
            🏆 {lastWinner.name} wins${lastWinner.amount > 0 ? ` $${lastWinner.amount.toLocaleString()}` : ''}!
          </p>
          {lastWinner.handName && (
            <p className="text-amber-400 text-sm mt-0.5">{lastWinner.handName}</p>
          )}
          {tournamentWinner ? (
            <p className="text-green-400 text-xs mt-0.5 font-semibold">Tournament Champion! 🎉</p>
          ) : (
            <p className="text-amber-500/80 text-xs mt-0.5">
              Press <span className="text-amber-400 font-semibold">Next Round</span> to keep playing with current chip counts.
            </p>
          )}
        </div>
      )}

      {/* Poker Table */}
      <div
        className="relative flex-shrink-0"
        style={{ width: 'min(70vw, 720px)', height: 'min(42vw, 430px)' }}
      >
        {/* Felt oval */}
        <div
          className="absolute rounded-[50%] border-[12px]"
          style={{
            inset: '60px 80px',
            borderColor: '#92400e',
            background: 'radial-gradient(ellipse at center, #166534 0%, #14532d 65%, #0f3d1f 100%)',
            boxShadow: '0 0 0 4px #78350f, 0 8px 40px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.4)',
          }}
        />

        {/* Community cards + pot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {communityCards.length > 0
              ? communityCards.map((c, i) => <Card key={i} {...c} />)
              : [0, 1, 2, 3, 4].map(i => <Card key={i} faceDown />)}
          </div>
          <div className="px-3 py-1 rounded-full bg-black/80 border border-amber-500/70 text-amber-300 font-bold text-xs tabular-nums">
            Pot: ${pot.toLocaleString()}
          </div>
        </div>

        {seats.map(seat => (
          <Seat key={seat.name} {...seat} />
        ))}
      </div>
    </div>
  );
}
