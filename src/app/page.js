'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createGame() {
    setLoading(true);
    try {
      const res = await fetch('/api/game', { method: 'POST' });
      const data = await res.json();

      // Store host token in sessionStorage
      sessionStorage.setItem(`host_${data.gameId}`, data.hostToken);

      // Redirect to host page
      router.push(`/host/${data.gameId}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-2">
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
              JEOPARDY!
            </span>
          </h1>
        </div>

        <p className="text-indigo-200/80 text-xl mb-16 font-light tracking-wide">
          The Ultimate Quiz Game
        </p>

        <button
          onClick={createGame}
          disabled={loading}
          className="group relative bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-bold text-xl py-5 px-14 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5"
        >
          <span className="relative z-10">
            {loading ? 'Creating Game...' : 'Create New Game'}
          </span>
        </button>

        <p className="text-indigo-300/50 mt-12 text-sm">
          Players will join by scanning a QR code on their phones
        </p>
      </div>
    </div>
  );
}
