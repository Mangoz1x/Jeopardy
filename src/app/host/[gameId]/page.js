'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

export default function HostPage() {
  const params = useParams();
  const gameId = params.gameId;

  const [hostToken, setHostToken] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [showQR, setShowQR] = useState(true);

  // Get host token from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem(`host_${gameId}`);
    if (token) {
      setHostToken(token);
    }
  }, [gameId]);

  // Generate QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const playerUrl = `${baseUrl}/play/${gameId}`;
      QRCode.toDataURL(playerUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(console.error);
    }
  }, [gameId]);

  // Poll for game state
  useEffect(() => {
    if (!hostToken) return;

    const pollInterval = gameState?.buzzerState === 'open' ? 200 : 1000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${gameId}/poll?hostToken=${hostToken}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => clearInterval(interval);
  }, [gameId, hostToken, gameState?.buzzerState]);

  // Countdown timer
  useEffect(() => {
    if (gameState?.buzzerState === 'open' && gameState?.buzzerOpenedAt) {
      const updateCountdown = () => {
        const elapsed = Date.now() - gameState.buzzerOpenedAt;
        const remaining = Math.max(0, 5000 - elapsed);
        setCountdown(Math.ceil(remaining / 1000));
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [gameState?.buzzerState, gameState?.buzzerOpenedAt]);

  const sendControl = useCallback(async (action, payload = {}) => {
    if (!hostToken) return;
    try {
      await fetch(`/api/game/${gameId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, action, payload }),
      });
    } catch (error) {
      console.error('Control error:', error);
    }
  }, [gameId, hostToken]);

  const selectQuestion = (categoryIdx, questionIdx) => {
    sendControl('selectQuestion', { categoryIdx, questionIdx });
  };

  if (!hostToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-indigo-200 text-xl mb-4">No host token found</p>
          <a href="/" className="text-amber-400 hover:text-amber-300 underline">
            Create a new game
          </a>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-200 text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  const firstBuzzer = gameState.buzzes[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
          JEOPARDY!
        </h1>
        <div className="flex gap-4 items-start">
          <button
            onClick={() => setShowQR(!showQR)}
            className="glass text-indigo-200 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {showQR ? 'Hide QR' : 'Show QR'}
          </button>
          {showQR && qrCodeUrl && (
            <div className="glass rounded-2xl p-3">
              <img src={qrCodeUrl} alt="Join QR Code" className="w-32 h-32 rounded-lg" />
              <p className="text-xs text-center mt-2 text-indigo-300">Scan to join</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Game Board */}
        <div className="flex-1">
          {/* Categories */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)` }}>
            {gameState.categories.map((cat, idx) => (
              <div
                key={idx}
                className="glass rounded-xl text-amber-300 text-center py-4 px-3 font-semibold text-sm uppercase tracking-wide"
              >
                {cat}
              </div>
            ))}
          </div>

          {/* Questions Grid */}
          {gameState.board[0]?.map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid gap-3 mt-3"
              style={{ gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)` }}
            >
              {gameState.board.map((category, catIdx) => {
                const question = category[rowIdx];
                const isSelected = gameState.currentQuestion?.categoryIdx === catIdx &&
                                   gameState.currentQuestion?.questionIdx === rowIdx;
                return (
                  <button
                    key={catIdx}
                    onClick={() => !question.used && selectQuestion(catIdx, rowIdx)}
                    disabled={question.used || gameState.currentQuestion !== null}
                    className={`
                      py-6 text-2xl font-bold rounded-xl transition-all duration-200
                      ${question.used
                        ? 'bg-slate-800/30 text-transparent cursor-default'
                        : 'glass text-amber-400 hover:bg-white/10 hover:text-amber-300 cursor-pointer hover:scale-[1.02]'
                      }
                      ${isSelected ? 'ring-2 ring-amber-400 bg-amber-400/10' : ''}
                    `}
                  >
                    ${question.value}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-4">
          {/* Players */}
          <div className="glass rounded-2xl p-5">
            <h2 className="text-amber-300 font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Players ({gameState.players.length})
            </h2>
            {gameState.players.length === 0 ? (
              <p className="text-indigo-300/60 text-sm">Waiting for players to join...</p>
            ) : (
              <div className="space-y-2">
                {gameState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, idx) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center p-3 rounded-xl ${
                        idx === 0 && player.score > 0 ? 'bg-amber-400/10' : 'bg-white/5'
                      }`}
                    >
                      <span className="text-indigo-100">{player.name}</span>
                      <span className={`font-bold ${player.score < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        ${player.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Current Question */}
          {gameState.currentQuestion && (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-amber-300 text-sm font-medium">{gameState.currentQuestion.category}</span>
                <span className="text-amber-400 font-bold">${gameState.currentQuestion.value}</span>
              </div>

              <p className="text-white text-lg mb-3 leading-relaxed">{gameState.currentQuestion.question}</p>

              <div className="bg-slate-800/50 rounded-xl p-3 mb-4">
                <p className="text-amber-300/80 text-sm">
                  <span className="text-indigo-400">Answer:</span> {gameState.currentQuestion.answer}
                </p>
              </div>

              {/* Buzzer Controls */}
              <div className="space-y-3">
                {gameState.buzzerState === 'closed' && (
                  <button
                    onClick={() => sendControl('openBuzzer')}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                  >
                    Open Buzzer (5s)
                  </button>
                )}

                {gameState.buzzerState === 'open' && (
                  <div className="text-center py-2">
                    <div className="text-5xl font-bold text-amber-400 mb-2 animate-pulse">{countdown}</div>
                    <p className="text-emerald-400 text-sm font-medium mb-3">Buzzer Open!</p>
                    <button
                      onClick={() => sendControl('closeBuzzer')}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-2 px-4 rounded-xl text-sm transition-colors"
                    >
                      Close Early
                    </button>
                  </div>
                )}

                {gameState.buzzerState === 'locked' && (
                  <p className="text-indigo-400 text-center py-2 font-medium">Buzzer Locked</p>
                )}
              </div>

              {/* Buzz Results */}
              {gameState.buzzes.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-amber-300 font-semibold mb-3 text-sm">Buzzed In</h3>
                  <div className="space-y-2">
                    {gameState.buzzes.map((buzz, idx) => (
                      <div
                        key={buzz.playerId}
                        className={`flex justify-between items-center p-3 rounded-xl transition-all ${
                          idx === 0
                            ? 'bg-gradient-to-r from-amber-400/20 to-yellow-400/20 border border-amber-400/30'
                            : 'bg-white/5'
                        }`}
                      >
                        <span className={idx === 0 ? 'text-amber-300 font-medium' : 'text-indigo-200'}>
                          {idx + 1}. {buzz.playerName}
                        </span>
                        {idx === 0 && (
                          <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">First</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Judging Buttons */}
              {firstBuzzer && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-indigo-300 text-sm text-center mb-3">
                    Judging <span className="text-amber-300 font-medium">{firstBuzzer.playerName}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendControl('awardPoints', { playerId: firstBuzzer.playerId })}
                      className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-3 rounded-xl transition-colors"
                    >
                      Correct
                    </button>
                    <button
                      onClick={() => sendControl('wrongAnswer', { playerId: firstBuzzer.playerId })}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 rounded-xl transition-colors"
                    >
                      Wrong
                    </button>
                  </div>
                </div>
              )}

              {/* Other Controls */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => sendControl('noWinner')}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-indigo-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  No Winner
                </button>
                <button
                  onClick={() => sendControl('resetQuestion')}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-indigo-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
