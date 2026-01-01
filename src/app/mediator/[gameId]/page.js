'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function MediatorPage() {
  const params = useParams();
  const gameId = params.gameId;

  const [mediatorToken, setMediatorToken] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(true);

  // Auto-join as mediator on mount
  useEffect(() => {
    const joinAsMediator = async () => {
      // Check if we already have a token
      const storedToken = sessionStorage.getItem(`mediator_${gameId}`);
      if (storedToken) {
        setMediatorToken(storedToken);
        setJoining(false);
        return;
      }

      try {
        const res = await fetch(`/api/game/${gameId}/mediator`, { method: 'POST' });
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setJoining(false);
          return;
        }

        sessionStorage.setItem(`mediator_${gameId}`, data.mediatorToken);
        setMediatorToken(data.mediatorToken);
        setJoining(false);
      } catch (err) {
        setError('Failed to connect as mediator');
        setJoining(false);
      }
    };

    joinAsMediator();
  }, [gameId]);

  // Generate QR code for players
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const playerUrl = `${baseUrl}/play/${gameId}`;
      QRCode.toDataURL(playerUrl, { width: 400, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(console.error);
    }
  }, [gameId]);

  // Poll for game state
  useEffect(() => {
    if (!mediatorToken) return;

    const pollInterval = gameState?.buzzerState === 'open' ? 200 : 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/mediator?mediatorToken=${mediatorToken}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
        } else if (res.status === 404) {
          setError('Game ended');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => clearInterval(interval);
  }, [gameId, mediatorToken, gameState?.buzzerState]);

  // Countdown timer - only stores the seconds value, visibility derived from gameState
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  useEffect(() => {
    if (gameState?.buzzerState !== 'open' || !gameState?.buzzerOpenedAt) {
      return;
    }

    const updateCountdown = () => {
      const elapsed = Date.now() - gameState.buzzerOpenedAt;
      const remaining = Math.max(0, 5000 - elapsed);
      setCountdownSeconds(Math.ceil(remaining / 1000));
    };

    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [gameState?.buzzerState, gameState?.buzzerOpenedAt]);

  // Loading state
  if (joining) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-200 text-2xl">Connecting to game...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{error}</h1>
          <Link href="/" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const firstBuzzer = gameState?.buzzes[0];

  // Pre-game: Show large QR code for players to join
  if (!gameState?.started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8">
        <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
          JEOPARDY!
        </h1>
        <p className="text-indigo-300 text-2xl mb-12">Scan to Join</p>

        {qrCodeUrl && (
          <div className="bg-white p-6 rounded-3xl shadow-2xl mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeUrl} alt="Join QR Code" className="w-72 h-72 md:w-96 md:h-96" />
          </div>
        )}

        {/* Players waiting */}
        <div className="glass rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-amber-300 font-semibold text-xl mb-4 text-center">
            Players ({gameState?.players.length || 0})
          </h2>
          {gameState?.players.length === 0 ? (
            <p className="text-indigo-300/60 text-center">Waiting for players...</p>
          ) : (
            <div className="flex flex-wrap gap-3 justify-center">
              {gameState?.players.map(player => (
                <div key={player.id} className="bg-white/10 px-4 py-2 rounded-full text-white">
                  {player.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-indigo-400 mt-8">Waiting for host to start the game...</p>
      </div>
    );
  }

  // Game in progress: Show board and current question
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
          JEOPARDY!
        </h1>

        {/* Scoreboard */}
        <div className="flex gap-4">
          {gameState?.players
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((player, idx) => (
              <div
                key={player.id}
                className={`glass rounded-xl px-4 py-2 text-center ${idx === 0 ? 'bg-amber-400/10' : ''}`}
              >
                <p className="text-indigo-200 text-sm">{player.name}</p>
                <p className={`font-bold text-lg ${player.score < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  ${player.score.toLocaleString()}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Current Question Overlay */}
      {gameState?.currentQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
          <div className="max-w-4xl w-full">
            {/* Category and Value */}
            <div className="text-center mb-8">
              <p className="text-amber-300 text-2xl mb-2">{gameState.currentQuestion.category}</p>
              <p className="text-amber-400 text-5xl font-bold">${gameState.currentQuestion.value}</p>
            </div>

            {/* Question */}
            <div className="glass rounded-3xl p-12 mb-8">
              <p className="text-white text-4xl md:text-5xl text-center leading-relaxed">
                {gameState.currentQuestion.question}
              </p>
            </div>

            {/* Buzzer Status */}
            <div className="text-center">
              {gameState.buzzerState === 'closed' && (
                <p className="text-indigo-400 text-2xl">Waiting for buzzers to open...</p>
              )}

              {gameState.buzzerState === 'open' && (
                <div>
                  <div className="text-8xl font-bold text-amber-400 mb-4 animate-pulse">{countdownSeconds}</div>
                  <p className="text-emerald-400 text-2xl">BUZZ NOW!</p>
                </div>
              )}

              {gameState.buzzerState === 'locked' && (
                <p className="text-indigo-400 text-2xl">Buzzer Locked</p>
              )}
            </div>

            {/* First Buzzer */}
            {firstBuzzer && (
              <div className="mt-8 text-center">
                <div className="inline-block bg-gradient-to-r from-amber-400/20 to-yellow-400/20 border border-amber-400/30 rounded-2xl px-12 py-6">
                  <p className="text-indigo-300 text-xl mb-2">First to buzz</p>
                  <p className="text-amber-400 text-4xl font-bold">{firstBuzzer.playerName}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Board */}
      <div className="max-w-6xl mx-auto">
        {/* Categories */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gameState?.categories.length || 6}, 1fr)` }}>
          {gameState?.categories.map((cat, idx) => (
            <div
              key={idx}
              className="glass rounded-xl text-amber-300 text-center py-4 px-3 font-semibold text-lg uppercase tracking-wide"
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Questions Grid */}
        {gameState?.board[0]?.map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid gap-3 mt-3"
            style={{ gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)` }}
          >
            {gameState.board.map((category, catIdx) => {
              const question = category[rowIdx];
              return (
                <div
                  key={catIdx}
                  className={`
                    py-8 text-3xl font-bold rounded-xl text-center
                    ${question.used
                      ? 'bg-slate-800/30 text-transparent'
                      : 'glass text-amber-400'
                    }
                  `}
                >
                  ${question.value}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
