import { v4 as uuidv4 } from 'uuid';
import questionsData from '@/data/questions.json';

// In-memory store for all games
const games = new Map();

export function createGame() {
  const gameId = uuidv4().slice(0, 8);
  const hostToken = uuidv4();

  // Build board from questions data
  const categories = questionsData.categories.map(cat => cat.name);
  const questions = questionsData.categories.map(cat =>
    cat.questions.map(q => ({
      value: q.value,
      question: q.question,
      answer: q.answer,
      used: false
    }))
  );

  const game = {
    id: gameId,
    hostToken,
    mediatorToken: null, // Set when mediator joins
    started: false, // When true, no more players can join
    board: { categories, questions },
    players: new Map(),
    currentQuestion: null,
    buzzerState: 'closed', // 'closed', 'open', 'locked'
    buzzerOpenedAt: null,
    buzzes: [],
    eliminatedFromRound: new Set(), // Players who got it wrong this round
  };

  games.set(gameId, game);
  return { gameId, hostToken };
}

export function getGame(gameId) {
  return games.get(gameId);
}

export function getPublicGameState(gameId, playerId = null) {
  const game = games.get(gameId);
  if (!game) return null;

  // Convert players Map to array
  const players = Array.from(game.players.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    score: data.score
  }));

  // Get current question info (without answer for players)
  let currentQuestionData = null;
  if (game.currentQuestion) {
    const { categoryIdx, questionIdx } = game.currentQuestion;
    const q = game.board.questions[categoryIdx][questionIdx];
    currentQuestionData = {
      category: game.board.categories[categoryIdx],
      value: q.value,
      question: q.question,
    };
  }

  return {
    id: game.id,
    started: game.started,
    hasMediator: !!game.mediatorToken,
    categories: game.board.categories,
    board: game.board.questions.map(cat =>
      cat.map(q => ({ value: q.value, used: q.used }))
    ),
    players,
    currentQuestion: currentQuestionData,
    buzzerState: game.buzzerState,
    buzzerOpenedAt: game.buzzerOpenedAt,
    buzzes: game.buzzes.map(b => ({
      playerId: b.playerId,
      playerName: game.players.get(b.playerId)?.name || 'Unknown',
      timestamp: b.timestamp
    })),
    eliminatedFromRound: Array.from(game.eliminatedFromRound),
    myBuzzed: playerId ? game.buzzes.some(b => b.playerId === playerId) : false,
    amEliminated: playerId ? game.eliminatedFromRound.has(playerId) : false,
  };
}

export function getHostGameState(gameId, hostToken) {
  const game = games.get(gameId);
  if (!game || game.hostToken !== hostToken) return null;

  const publicState = getPublicGameState(gameId);

  // Add answer for host
  if (game.currentQuestion) {
    const { categoryIdx, questionIdx } = game.currentQuestion;
    const q = game.board.questions[categoryIdx][questionIdx];
    publicState.currentQuestion.answer = q.answer;
  }

  return publicState;
}

export function getMediatorGameState(gameId, mediatorToken) {
  const game = games.get(gameId);
  if (!game || game.mediatorToken !== mediatorToken) return null;

  // Mediator gets public state (no answer shown)
  return getPublicGameState(gameId);
}

export function joinAsMediator(gameId) {
  const game = games.get(gameId);
  if (!game) return { error: 'Game not found' };

  // Only one mediator allowed
  if (game.mediatorToken) {
    return { error: 'Mediator already connected' };
  }

  const mediatorToken = uuidv4();
  game.mediatorToken = mediatorToken;

  return { mediatorToken };
}

export function joinGame(gameId, playerName) {
  const game = games.get(gameId);
  if (!game) return { error: 'Game not found' };

  // Check if game has started
  if (game.started) {
    return { error: 'Game has already started' };
  }

  // Check for duplicate names
  for (const [, data] of game.players) {
    if (data.name.toLowerCase() === playerName.toLowerCase()) {
      return { error: 'Name already taken' };
    }
  }

  const playerId = uuidv4().slice(0, 8);
  game.players.set(playerId, { name: playerName, score: 0 });

  return { playerId, playerName };
}

export function buzz(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) return { error: 'Game not found' };
  if (game.buzzerState !== 'open') return { error: 'Buzzer is not open' };
  if (!game.players.has(playerId)) return { error: 'Player not in game' };
  if (game.eliminatedFromRound.has(playerId)) return { error: 'You already got this question wrong' };
  if (game.buzzes.some(b => b.playerId === playerId)) return { error: 'Already buzzed' };

  const timestamp = Date.now();
  game.buzzes.push({ playerId, timestamp });

  // Sort by timestamp
  game.buzzes.sort((a, b) => a.timestamp - b.timestamp);

  return { success: true, position: game.buzzes.findIndex(b => b.playerId === playerId) + 1 };
}

export function controlGame(gameId, hostToken, action, payload = {}) {
  const game = games.get(gameId);
  if (!game) return { error: 'Game not found' };
  if (game.hostToken !== hostToken) return { error: 'Invalid host token' };

  switch (action) {
    case 'startGame': {
      game.started = true;
      return { success: true };
    }

    case 'selectQuestion': {
      const { categoryIdx, questionIdx } = payload;
      if (game.board.questions[categoryIdx]?.[questionIdx]?.used) {
        return { error: 'Question already used' };
      }
      game.currentQuestion = { categoryIdx, questionIdx };
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = new Set();
      return { success: true };
    }

    case 'openBuzzer': {
      if (!game.currentQuestion) return { error: 'No question selected' };
      game.buzzerState = 'open';
      game.buzzerOpenedAt = Date.now();
      // Auto-close after 5 seconds is handled client-side + poll
      return { success: true };
    }

    case 'closeBuzzer': {
      game.buzzerState = 'locked';
      return { success: true };
    }

    case 'awardPoints': {
      const { playerId } = payload;
      if (!game.currentQuestion) return { error: 'No question selected' };
      const { categoryIdx, questionIdx } = game.currentQuestion;
      const question = game.board.questions[categoryIdx][questionIdx];

      const player = game.players.get(playerId);
      if (player) {
        player.score += question.value;
      }

      // Mark question as used
      question.used = true;
      game.currentQuestion = null;
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = new Set();

      return { success: true };
    }

    case 'wrongAnswer': {
      const { playerId } = payload;
      if (!game.currentQuestion) return { error: 'No question selected' };
      const { categoryIdx, questionIdx } = game.currentQuestion;
      const question = game.board.questions[categoryIdx][questionIdx];

      const player = game.players.get(playerId);
      if (player) {
        player.score -= question.value;
      }

      // Add to eliminated set
      game.eliminatedFromRound.add(playerId);

      // Clear buzzes and reopen for others
      game.buzzes = [];
      game.buzzerState = 'open';
      game.buzzerOpenedAt = Date.now();

      return { success: true };
    }

    case 'noWinner': {
      if (!game.currentQuestion) return { error: 'No question selected' };
      const { categoryIdx, questionIdx } = game.currentQuestion;

      // Mark question as used without awarding points
      game.board.questions[categoryIdx][questionIdx].used = true;
      game.currentQuestion = null;
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = new Set();

      return { success: true };
    }

    case 'resetQuestion': {
      // Keep the same question but reset buzzer state
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = new Set();
      return { success: true };
    }

    case 'disconnectMediator': {
      game.mediatorToken = null;
      return { success: true };
    }

    case 'endGame': {
      games.delete(gameId);
      return { success: true, ended: true };
    }

    default:
      return { error: 'Unknown action' };
  }
}

// Auto-close buzzer after 5 seconds (called from poll endpoint)
export function checkBuzzerTimeout(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  if (game.buzzerState === 'open' && game.buzzerOpenedAt) {
    const elapsed = Date.now() - game.buzzerOpenedAt;
    if (elapsed >= 5000) {
      game.buzzerState = 'locked';
    }
  }
}
