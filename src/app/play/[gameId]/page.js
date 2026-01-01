'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

export default function PlayerPage() {
  const params = useParams();
  const gameId = params.gameId;

  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [gameState, setGameState] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [buzzed, setBuzzed] = useState(false);
  const [buzzPosition, setBuzzPosition] = useState(null);
  const [gameNotFound, setGameNotFound] = useState(false);

  // Load player from sessionStorage
  useEffect(() => {
    const storedPlayerId = sessionStorage.getItem(`player_${gameId}`);
    const storedPlayerName = sessionStorage.getItem(`playerName_${gameId}`);
    if (storedPlayerId && storedPlayerName) {
      setPlayerId(storedPlayerId);
      setPlayerName(storedPlayerName);
    }
  }, [gameId]);

  // Check if game exists on mount
  useEffect(() => {
    const checkGame = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}`);
        if (!res.ok) {
          setGameNotFound(true);
        }
      } catch {
        setGameNotFound(true);
      }
    };
    checkGame();
  }, [gameId]);

  // Poll for game state
  useEffect(() => {
    if (!playerId) return;

    const pollInterval = gameState?.buzzerState === 'open' ? 200 : 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/poll?playerId=${playerId}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);

          // Check if buzzer was reset (new round)
          if (data.buzzerState === 'closed' && buzzed) {
            setBuzzed(false);
            setBuzzPosition(null);
          }
        } else if (res.status === 404) {
          setGameNotFound(true);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => clearInterval(interval);
  }, [gameId, playerId, gameState?.buzzerState, buzzed]);

  const joinGame = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setJoining(true);
    setError('');

    try {
      const res = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: nameInput.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setJoining(false);
        return;
      }

      sessionStorage.setItem(`player_${gameId}`, data.playerId);
      sessionStorage.setItem(`playerName_${gameId}`, data.playerName);
      setPlayerId(data.playerId);
      setPlayerName(data.playerName);
    } catch (error) {
      setError('Failed to join game');
      setJoining(false);
    }
  };

  const handleBuzz = useCallback(async () => {
    if (!playerId || gameState?.buzzerState !== 'open' || buzzed || gameState?.amEliminated) return;

    setBuzzed(true);

    try {
      const res = await fetch(`/api/game/${gameId}/buzz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });

      const data = await res.json();
      if (data.position) {
        setBuzzPosition(data.position);
      }
    } catch (error) {
      console.error('Buzz error:', error);
    }
  }, [gameId, playerId, gameState?.buzzerState, gameState?.amEliminated, buzzed]);

  // Game not found
  if (gameNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Game Not Found</h1>
          <p className="text-indigo-300/70 mb-6">This game doesn't exist or has ended.</p>
          <a
            href="/"
            className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  // Join screen
  if (!playerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          <h1 className="text-5xl font-bold text-center mb-8 bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
            JEOPARDY!
          </h1>

          <form onSubmit={joinGame} className="space-y-4">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-5 py-4 rounded-2xl text-lg text-center bg-white/10 border border-white/20 text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent transition-all"
              autoFocus
            />

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-center text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={joining || !nameInput.trim()}
              className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-bold text-xl py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
            >
              {joining ? 'Joining...' : 'Join Game'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Get player score
  const myPlayer = gameState?.players.find(p => p.id === playerId);
  const myScore = myPlayer?.score ?? 0;

  // Determine buzzer state
  const canBuzz = gameState?.buzzerState === 'open' && !buzzed && !gameState?.amEliminated;
  const isOpen = gameState?.buzzerState === 'open';
  const isLocked = gameState?.buzzerState === 'locked';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 p-5 flex justify-between items-center">
        <div>
          <p className="text-indigo-300 text-sm">{playerName}</p>
          <p className={`text-3xl font-bold ${myScore < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            ${myScore.toLocaleString()}
          </p>
        </div>
        {gameState?.currentQuestion && (
          <div className="text-right glass rounded-xl px-4 py-2">
            <p className="text-amber-300 text-xs">{gameState.currentQuestion.category}</p>
            <p className="text-white font-bold">${gameState.currentQuestion.value}</p>
          </div>
        )}
      </div>

      {/* Main Buzzer Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        {/* Status Messages */}
        {gameState?.amEliminated && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-6 py-3 mb-6">
            <p className="text-red-400 text-center">You got it wrong - wait for next question</p>
          </div>
        )}

        {buzzed && buzzPosition && (
          <div className="mb-6 text-center">
            <p className={`text-3xl font-bold ${buzzPosition === 1 ? 'text-amber-400' : 'text-indigo-300'}`}>
              {buzzPosition === 1 ? 'FIRST!' : `#${buzzPosition}`}
            </p>
          </div>
        )}

        {/* Buzzer Button */}
        <button
          onClick={handleBuzz}
          disabled={!canBuzz}
          className={`
            w-56 h-56 md:w-64 md:h-64 rounded-full font-bold text-2xl md:text-3xl transition-all duration-200 transform
            ${canBuzz
              ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 text-white animate-pulse-glow'
              : buzzed
                ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-400'
                : isLocked
                  ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-500'
                  : 'bg-gradient-to-br from-slate-800 to-slate-900 text-slate-600'
            }
          `}
        >
          {buzzed
            ? 'BUZZED!'
            : isOpen
              ? 'BUZZ!'
              : isLocked
                ? 'LOCKED'
                : 'WAIT...'
          }
        </button>

        {/* Countdown */}
        {isOpen && gameState?.buzzerOpenedAt && (
          <BuzzerCountdown openedAt={gameState.buzzerOpenedAt} />
        )}

        {/* Status Text */}
        <div className="mt-8 text-center">
          {gameState?.currentQuestion && !isOpen && !isLocked && (
            <p className="text-indigo-300/60">
              Question selected - wait for buzzer
            </p>
          )}

          {!gameState?.currentQuestion && (
            <p className="text-indigo-300/60">
              Waiting for host to select a question...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BuzzerCountdown({ openedAt }) {
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, 5000 - elapsed);
      setRemaining(Math.ceil(remaining / 1000));
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [openedAt]);

  return (
    <div className="mt-8">
      <div className="text-6xl md:text-7xl font-bold text-amber-400">{remaining}</div>
    </div>
  );
}
