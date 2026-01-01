'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId;

  const [gameState, setGameState] = useState(null);
  const [playerQrUrl, setPlayerQrUrl] = useState('');
  const [mediatorQrUrl, setMediatorQrUrl] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Get host token from sessionStorage (only runs on client)
  const hostToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`host_${gameId}`);
  }, [gameId]);

  // Generate QR codes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;

      // Player QR
      QRCode.toDataURL(`${baseUrl}/play/${gameId}`, { width: 200, margin: 2 })
        .then(url => setPlayerQrUrl(url))
        .catch(console.error);

      // Mediator QR
      QRCode.toDataURL(`${baseUrl}/mediator/${gameId}`, { width: 200, margin: 2 })
        .then(url => setMediatorQrUrl(url))
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
        } else if (res.status === 404) {
          // Game was ended
          router.push('/');
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => clearInterval(interval);
  }, [gameId, hostToken, gameState?.buzzerState, router]);

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

  // Derive countdown visibility from gameState
  const showCountdown = gameState?.buzzerState === 'open' && gameState?.buzzerOpenedAt;

  const sendControl = useCallback(async (action, payload = {}) => {
    if (!hostToken) return;
    try {
      const res = await fetch(`/api/game/${gameId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, action, payload }),
      });
      const data = await res.json();
      if (data.ended) {
        router.push('/');
      }
    } catch (error) {
      console.error('Control error:', error);
    }
  }, [gameId, hostToken, router]);

  const selectQuestion = (categoryIdx, questionIdx) => {
    sendControl('selectQuestion', { categoryIdx, questionIdx });
  };

  if (!hostToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-indigo-200 text-xl mb-4">No host token found</p>
          <Link href="/" className="text-amber-400 hover:text-amber-300 underline">
            Create a new game
          </Link>
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

  // Pre-game lobby
  if (!gameState.started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
              JEOPARDY!
            </h1>
            <p className="text-indigo-300">Game Lobby</p>
          </div>

          {/* QR Codes */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Player QR */}
            <div className="glass rounded-2xl p-6 text-center">
              <h2 className="text-amber-300 font-semibold text-xl mb-4">Players Scan Here</h2>
              {playerQrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={playerQrUrl} alt="Player QR" className="w-48 h-48 mx-auto rounded-xl bg-white p-2" />
              )}
              <p className="text-indigo-300/70 text-sm mt-4">Players join on their phones</p>
            </div>

            {/* Mediator QR */}
            <div className="glass rounded-2xl p-6 text-center">
              <h2 className="text-amber-300 font-semibold text-xl mb-4">TV Display (Optional)</h2>
              {mediatorQrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediatorQrUrl} alt="Mediator QR" className="w-48 h-48 mx-auto rounded-xl bg-white p-2" />
              )}
              <p className="text-indigo-300/70 text-sm mt-4">
                {gameState.hasMediator ? (
                  <span className="text-emerald-400">TV Display Connected</span>
                ) : (
                  'Scan from a device casting to TV'
                )}
              </p>
            </div>
          </div>

          {/* Players List */}
          <div className="glass rounded-2xl p-6 mb-8">
            <h2 className="text-amber-300 font-semibold text-xl mb-4">
              Players Joined ({gameState.players.length})
            </h2>
            {gameState.players.length === 0 ? (
              <p className="text-indigo-300/60 text-center py-8">Waiting for players to scan the QR code...</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {gameState.players.map(player => (
                  <div key={player.id} className="bg-white/10 px-5 py-3 rounded-xl text-white text-lg">
                    {player.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Game Button */}
          <div className="text-center">
            <button
              onClick={() => sendControl('startGame')}
              disabled={gameState.players.length === 0}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold text-2xl py-5 px-16 rounded-2xl transition-all shadow-lg shadow-emerald-500/25 disabled:shadow-none disabled:cursor-not-allowed"
            >
              Start Game
            </button>
            {gameState.players.length === 0 && (
              <p className="text-indigo-400 mt-4">Need at least 1 player to start</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Game in progress
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* End Game Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="glass rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-white text-2xl font-bold mb-4">End Game?</h2>
            <p className="text-indigo-300 mb-6">This will end the game for all players. This cannot be undone.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => sendControl('endGame')}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-black/20 border-b border-white/10 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
            JEOPARDY! - Host Control
          </h1>
          <button
            onClick={() => setShowEndConfirm(true)}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            End Game
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Side - Game Board */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Categories */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)` }}>
            {gameState.categories.map((cat, idx) => (
              <div
                key={idx}
                className="glass rounded-lg text-amber-300 text-center py-3 px-2 font-semibold text-xs uppercase tracking-wide"
              >
                {cat}
              </div>
            ))}
          </div>

          {/* Questions Grid */}
          {gameState.board[0]?.map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid gap-2 mt-2"
              style={{ gridTemplateColumns: `repeat(${gameState.categories.length}, 1fr)` }}
            >
              {gameState.board.map((category, catIdx) => {
                const question = category[rowIdx];
                const isSelected = gameState.currentQuestion?.categoryIdx === catIdx &&
                                   gameState.currentQuestion?.questionIdx === rowIdx;
                return (
                  <button
                    key={catIdx}
                    onClick={() => !question.used && !gameState.currentQuestion && selectQuestion(catIdx, rowIdx)}
                    disabled={question.used || gameState.currentQuestion !== null}
                    className={`
                      py-5 text-xl font-bold rounded-lg transition-all duration-200
                      ${question.used
                        ? 'bg-slate-800/20 text-slate-700 cursor-default'
                        : gameState.currentQuestion
                          ? 'glass text-amber-400/50 cursor-not-allowed'
                          : 'glass text-amber-400 hover:bg-white/10 hover:text-amber-300 cursor-pointer hover:scale-[1.02]'
                      }
                      ${isSelected ? 'ring-2 ring-amber-400 bg-amber-400/20' : ''}
                    `}
                  >
                    {question.used ? '' : `$${question.value}`}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Side - Control Panel */}
        <div className="w-96 bg-black/20 border-l border-white/10 p-6 overflow-auto">
          {/* Scoreboard */}
          <div className="mb-6">
            <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scoreboard
            </h2>
            <div className="space-y-2">
              {gameState.players.length === 0 ? (
                <p className="text-indigo-300/60 text-sm">No players</p>
              ) : (
                gameState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, idx) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center p-3 rounded-xl ${
                        idx === 0 && player.score > 0 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-white/5'
                      }`}
                    >
                      <span className="text-white">{player.name}</span>
                      <span className={`font-bold text-lg ${player.score < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        ${player.score.toLocaleString()}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Current Question Panel */}
          {gameState.currentQuestion ? (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-amber-300 font-medium">{gameState.currentQuestion.category}</span>
                <span className="text-amber-400 font-bold text-xl">${gameState.currentQuestion.value}</span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                <p className="text-white leading-relaxed">{gameState.currentQuestion.question}</p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
                <p className="text-emerald-300 text-sm">
                  <span className="font-medium">Answer:</span> {gameState.currentQuestion.answer}
                </p>
              </div>

              {/* Buzzer Section */}
              <div className="border-t border-white/10 pt-4">
                {gameState.buzzerState === 'closed' && (
                  <button
                    onClick={() => sendControl('openBuzzer')}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-lg"
                  >
                    Open Buzzer
                  </button>
                )}

                {gameState.buzzerState === 'open' && (
                  <div className="text-center">
                    <div className="text-6xl font-bold text-amber-400 mb-2 animate-pulse">{countdownSeconds}</div>
                    <p className="text-emerald-400 font-medium mb-4">Buzzer Open!</p>
                    <button
                      onClick={() => sendControl('closeBuzzer')}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-2 px-6 rounded-xl transition-colors"
                    >
                      Close Early
                    </button>
                  </div>
                )}

                {gameState.buzzerState === 'locked' && !firstBuzzer && (
                  <div className="text-center py-4">
                    <p className="text-indigo-400 mb-4">No one buzzed in</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendControl('openBuzzer')}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => sendControl('noWinner')}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Buzz Results */}
              {gameState.buzzes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h3 className="text-amber-300 font-semibold mb-3">Buzzed In</h3>
                  <div className="space-y-2 mb-4">
                    {gameState.buzzes.map((buzz, idx) => (
                      <div
                        key={buzz.playerId}
                        className={`flex justify-between items-center p-3 rounded-xl ${
                          idx === 0
                            ? 'bg-gradient-to-r from-amber-400/20 to-yellow-400/20 border border-amber-400/30'
                            : 'bg-white/5'
                        }`}
                      >
                        <span className={idx === 0 ? 'text-amber-300 font-medium' : 'text-indigo-200'}>
                          {idx + 1}. {buzz.playerName}
                        </span>
                        {idx === 0 && (
                          <span className="text-amber-400 text-xs font-bold uppercase">First</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Judging First Buzzer */}
                  {firstBuzzer && (
                    <div>
                      <p className="text-indigo-300 text-sm text-center mb-3">
                        <span className="text-amber-300 font-medium">{firstBuzzer.playerName}</span> is answering
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => sendControl('awardPoints', { playerId: firstBuzzer.playerId })}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-colors text-lg"
                        >
                          Correct
                        </button>
                        <button
                          onClick={() => sendControl('wrongAnswer', { playerId: firstBuzzer.playerId })}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors text-lg"
                        >
                          Wrong
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Question Controls */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendControl('noWinner')}
                    className="bg-white/5 hover:bg-white/10 text-indigo-300 font-medium py-3 rounded-xl transition-colors text-sm"
                  >
                    No Winner
                  </button>
                  <button
                    onClick={() => sendControl('resetQuestion')}
                    className="bg-white/5 hover:bg-white/10 text-indigo-300 font-medium py-3 rounded-xl transition-colors text-sm"
                  >
                    Reset Buzzer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-indigo-300">Click a dollar amount on the board to select a question</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
