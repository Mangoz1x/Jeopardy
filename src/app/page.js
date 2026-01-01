'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState('select'); // 'select', 'generate', 'preview'
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Generation settings
  const [topics, setTopics] = useState('');
  const [numCategories, setNumCategories] = useState(6);
  const [questionsPerCategory, setQuestionsPerCategory] = useState(5);

  // Generated questions
  const [generatedQuestions, setGeneratedQuestions] = useState(null);

  async function createGame(customQuestions = null) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customQuestions }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Store host token in sessionStorage
      sessionStorage.setItem(`host_${data.gameId}`, data.hostToken);

      // Redirect to host page
      router.push(`/host/${data.gameId}`);
    } catch (err) {
      console.error('Failed to create game:', err);
      setError('Failed to create game');
      setLoading(false);
    }
  }

  async function generateQuestions() {
    if (!topics.trim()) {
      setError('Please enter at least one topic');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const topicList = topics.split(',').map(t => t.trim()).filter(Boolean);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: topicList,
          numCategories,
          questionsPerCategory,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setGenerating(false);
        return;
      }

      setGeneratedQuestions(data);
      setMode('preview');
    } catch (err) {
      console.error('Failed to generate questions:', err);
      setError('Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  }

  // Mode: Select between quick start and custom generation
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-2xl">
          {/* Logo */}
          <div className="mb-2">
            <h1 className="text-7xl md:text-8xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
                JEOPARDY!
              </span>
            </h1>
          </div>

          <p className="text-indigo-200/80 text-xl mb-12 font-light tracking-wide">
            The Ultimate Quiz Game
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Quick Start */}
            <button
              onClick={() => createGame()}
              disabled={loading}
              className="group glass rounded-2xl p-8 text-left hover:bg-white/10 transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Quick Start</h2>
              <p className="text-indigo-300/70 text-sm">
                Start immediately with pre-made trivia questions covering various topics.
              </p>
            </button>

            {/* AI Generated */}
            <button
              onClick={() => setMode('generate')}
              disabled={loading}
              className="group glass rounded-2xl p-8 text-left hover:bg-white/10 transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Custom Topics</h2>
              <p className="text-indigo-300/70 text-sm">
                Generate unique questions using AI based on your chosen topics.
              </p>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-indigo-200">Creating game...</p>
            </div>
          )}

          <p className="text-indigo-300/50 text-sm">
            Players will join by scanning a QR code on their phones
          </p>
        </div>
      </div>
    );
  }

  // Mode: Generate custom questions
  if (mode === 'generate') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-xl">
          {/* Back button */}
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Generate Questions</h1>
                <p className="text-indigo-300/70 text-sm">AI will create custom Jeopardy questions</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Topics Input */}
              <div>
                <label className="block text-indigo-200 text-sm font-medium mb-2">
                  Topics (comma separated)
                </label>
                <textarea
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g., World History, Space Exploration, Pop Culture, Sports"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent transition-all resize-none"
                />
                <p className="text-indigo-400/60 text-xs mt-1">
                  Enter topics you want questions about. Be specific for better results.
                </p>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-indigo-200 text-sm font-medium mb-2">
                    Categories
                  </label>
                  <select
                    value={numCategories}
                    onChange={(e) => setNumCategories(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent transition-all"
                  >
                    {[3, 4, 5, 6].map(n => (
                      <option key={n} value={n} className="bg-slate-800">{n} categories</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-indigo-200 text-sm font-medium mb-2">
                    Questions per Category
                  </label>
                  <select
                    value={questionsPerCategory}
                    onChange={(e) => setQuestionsPerCategory(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent transition-all"
                  >
                    {[3, 4, 5].map(n => (
                      <option key={n} value={n} className="bg-slate-800">{n} questions</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateQuestions}
                disabled={generating || !topics.trim()}
                className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-400 font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    Generating Questions...
                  </span>
                ) : (
                  'Generate Questions'
                )}
              </button>

              {generating && (
                <p className="text-indigo-400/70 text-center text-sm">
                  This may take 10-30 seconds depending on the number of questions...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode: Preview generated questions
  if (mode === 'preview' && generatedQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <button
                onClick={() => setMode('generate')}
                className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 mb-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Edit
              </button>
              <h1 className="text-3xl font-bold text-white">Preview Questions</h1>
              <p className="text-indigo-300/70">Review your generated questions before starting</p>
            </div>
            <button
              onClick={() => createGame(generatedQuestions)}
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg py-4 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Start Game'
              )}
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(generatedQuestions.categories.length, 3)}, 1fr)` }}>
            {generatedQuestions.categories.map((category, catIdx) => (
              <div key={catIdx} className="glass rounded-2xl overflow-hidden">
                {/* Category Header */}
                <div className="bg-gradient-to-r from-amber-400/20 to-yellow-400/20 px-5 py-4 border-b border-white/10">
                  <h2 className="text-amber-300 font-bold text-lg uppercase tracking-wide">
                    {category.name}
                  </h2>
                </div>

                {/* Questions */}
                <div className="p-4 space-y-3">
                  {category.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-amber-400 font-bold">${q.value}</span>
                      </div>
                      <p className="text-white text-sm mb-2">{q.question}</p>
                      <p className="text-emerald-400 text-xs border-t border-white/10 pt-2 mt-2">
                        {q.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Regenerate Button */}
          <div className="text-center mt-8">
            <button
              onClick={() => {
                setGeneratedQuestions(null);
                setMode('generate');
              }}
              className="text-indigo-300 hover:text-indigo-200 text-sm transition-colors"
            >
              Not happy? Go back and regenerate
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
