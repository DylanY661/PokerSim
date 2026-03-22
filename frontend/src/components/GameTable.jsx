import Card from './Card';
import Seat from './Seat';

export default function GameTable({ seats, communityCards, pot, lastWinner, gameRunning, tournamentWinner }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-4 min-w-0">

      {/* Winner banner */}
      {lastWinner && !gameRunning && (
        <div className={`w-full max-w-xl px-5 py-3 rounded-xl border text-center flex-shrink-0 ${
          tournamentWinner
            ? 'bg-green-950/60 border-green-600/50'
            : 'bg-amber-950/60 border-amber-600/50'
        }`}>
          <p className={`font-bold text-lg ${tournamentWinner ? 'text-green-300' : 'text-amber-300'}`}>
            🏆 {lastWinner.name} wins${lastWinner.amount > 0 ? ` $${lastWinner.amount}` : ''}!
          </p>
          {lastWinner.handName && (
            <p className="text-amber-400 text-sm mt-0.5">{lastWinner.handName}</p>
          )}
          {tournamentWinner ? (
            <p className="text-green-400 text-xs mt-0.5 font-semibold">Tournament Champion! 🎉</p>
          ) : (
            <p className="text-amber-500/80 text-xs mt-0.5">
              Press <span className="text-green-400 font-semibold">Next Round</span> to keep playing with current chip counts.
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
          className="absolute rounded-[50%] border-[12px] border-amber-900 shadow-2xl"
          style={{
            inset: '60px 80px',
            background: 'radial-gradient(ellipse at center, #166534 0%, #14532d 65%, #0f3d1f 100%)',
          }}
        />

        {/* Community cards + pot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {communityCards.length > 0
              ? communityCards.map((c, i) => <Card key={i} {...c} />)
              : [0, 1, 2, 3, 4].map(i => <Card key={i} faceDown />)}
          </div>
          <div className="px-3 py-1 rounded-full bg-black/60 border border-amber-600/60 text-amber-300 font-bold text-xs">
            Pot: ${pot}
          </div>
        </div>

        {seats.map(seat => (
          <Seat key={seat.name} {...seat} />
        ))}
      </div>
    </div>
  );
}
