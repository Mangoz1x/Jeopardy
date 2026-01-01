import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import questionsData from '@/data/questions.json';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Game TTL: 4 hours (in seconds)
const GAME_TTL = 4 * 60 * 60;

export async function createGame(customQuestions = null) {
  const gameId = uuidv4().slice(0, 8);
  const hostToken = uuidv4();

  // Use custom questions if provided, otherwise use default
  const sourceData = customQuestions || questionsData;

  // Build board from questions data
  const categories = sourceData.categories.map(cat => cat.name);
  const questions = sourceData.categories.map(cat =>
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
    mediatorToken: null,
    started: false,
    board: { categories, questions },
    players: {}, // Object instead of Map for JSON serialization
    currentQuestion: null,
    buzzerState: 'closed',
    buzzerOpenedAt: null,
    buzzes: [],
    eliminatedFromRound: [], // Array instead of Set for JSON serialization
    answerRevealed: false,
  };

  await redis.set(`game:${gameId}`, game, { ex: GAME_TTL });
  return { gameId, hostToken };
}

export async function getGame(gameId) {
  return await redis.get(`game:${gameId}`);
}

async function saveGame(game) {
  await redis.set(`game:${game.id}`, game, { ex: GAME_TTL });
}

export async function getPublicGameState(gameId, playerId = null) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return null;

  // Convert players object to array
  const players = Object.entries(game.players).map(([id, data]) => ({
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
      playerName: game.players[b.playerId]?.name || 'Unknown',
      timestamp: b.timestamp
    })),
    eliminatedFromRound: game.eliminatedFromRound,
    myBuzzed: playerId ? game.buzzes.some(b => b.playerId === playerId) : false,
    amEliminated: playerId ? game.eliminatedFromRound.includes(playerId) : false,
    answerRevealed: game.answerRevealed,
  };
}

export async function getHostGameState(gameId, hostToken) {
  const game = await redis.get(`game:${gameId}`);
  if (!game || game.hostToken !== hostToken) return null;

  const publicState = await getPublicGameState(gameId);

  // Add answer for host
  if (game.currentQuestion) {
    const { categoryIdx, questionIdx } = game.currentQuestion;
    const q = game.board.questions[categoryIdx][questionIdx];
    publicState.currentQuestion.answer = q.answer;
  }

  return publicState;
}

export async function getMediatorGameState(gameId, mediatorToken) {
  const game = await redis.get(`game:${gameId}`);
  if (!game || game.mediatorToken !== mediatorToken) return null;

  // Mediator gets public state
  const publicState = await getPublicGameState(gameId);

  // Include answer if revealed
  if (game.answerRevealed && game.currentQuestion) {
    const { categoryIdx, questionIdx } = game.currentQuestion;
    const q = game.board.questions[categoryIdx][questionIdx];
    publicState.currentQuestion.answer = q.answer;
  }

  return publicState;
}

export async function joinAsMediator(gameId) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return { error: 'Game not found' };

  // Only one mediator allowed
  if (game.mediatorToken) {
    return { error: 'Mediator already connected' };
  }

  const mediatorToken = uuidv4();
  game.mediatorToken = mediatorToken;
  await saveGame(game);

  return { mediatorToken };
}

export async function joinGame(gameId, playerName) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return { error: 'Game not found' };

  // Check if game has started
  if (game.started) {
    return { error: 'Game has already started' };
  }

  // Check for duplicate names
  for (const [, data] of Object.entries(game.players)) {
    if (data.name.toLowerCase() === playerName.toLowerCase()) {
      return { error: 'Name already taken' };
    }
  }

  const playerId = uuidv4().slice(0, 8);
  game.players[playerId] = { name: playerName, score: 0 };
  await saveGame(game);

  return { playerId, playerName };
}

export async function buzz(gameId, playerId) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return { error: 'Game not found' };
  if (game.buzzerState !== 'open') return { error: 'Buzzer is not open' };
  if (!game.players[playerId]) return { error: 'Player not in game' };
  if (game.eliminatedFromRound.includes(playerId)) return { error: 'You already got this question wrong' };
  if (game.buzzes.some(b => b.playerId === playerId)) return { error: 'Already buzzed' };

  const timestamp = Date.now();
  game.buzzes.push({ playerId, timestamp });

  // Sort by timestamp
  game.buzzes.sort((a, b) => a.timestamp - b.timestamp);
  await saveGame(game);

  return { success: true, position: game.buzzes.findIndex(b => b.playerId === playerId) + 1 };
}

export async function controlGame(gameId, hostToken, action, payload = {}) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return { error: 'Game not found' };
  if (game.hostToken !== hostToken) return { error: 'Invalid host token' };

  switch (action) {
    case 'startGame': {
      game.started = true;
      await saveGame(game);
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
      game.eliminatedFromRound = [];
      game.answerRevealed = false;
      await saveGame(game);
      return { success: true };
    }

    case 'revealAnswer': {
      if (!game.currentQuestion) return { error: 'No question selected' };
      game.answerRevealed = true;
      await saveGame(game);
      return { success: true };
    }

    case 'openBuzzer': {
      if (!game.currentQuestion) return { error: 'No question selected' };
      game.buzzerState = 'open';
      game.buzzerOpenedAt = Date.now();
      await saveGame(game);
      return { success: true };
    }

    case 'closeBuzzer': {
      game.buzzerState = 'locked';
      await saveGame(game);
      return { success: true };
    }

    case 'awardPoints': {
      const { playerId } = payload;
      if (!game.currentQuestion) return { error: 'No question selected' };
      const { categoryIdx, questionIdx } = game.currentQuestion;
      const question = game.board.questions[categoryIdx][questionIdx];

      if (game.players[playerId]) {
        game.players[playerId].score += question.value;
      }

      // Mark question as used
      question.used = true;
      game.currentQuestion = null;
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = [];
      await saveGame(game);

      return { success: true };
    }

    case 'wrongAnswer': {
      const { playerId } = payload;
      if (!game.currentQuestion) return { error: 'No question selected' };
      const { categoryIdx, questionIdx } = game.currentQuestion;
      const question = game.board.questions[categoryIdx][questionIdx];

      if (game.players[playerId]) {
        game.players[playerId].score -= question.value;
      }

      // Add to eliminated array
      if (!game.eliminatedFromRound.includes(playerId)) {
        game.eliminatedFromRound.push(playerId);
      }

      // Clear buzzes and reopen for others
      game.buzzes = [];
      game.buzzerState = 'open';
      game.buzzerOpenedAt = Date.now();
      await saveGame(game);

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
      game.eliminatedFromRound = [];
      await saveGame(game);

      return { success: true };
    }

    case 'resetQuestion': {
      // Keep the same question but reset buzzer state
      game.buzzerState = 'closed';
      game.buzzes = [];
      game.eliminatedFromRound = [];
      await saveGame(game);
      return { success: true };
    }

    case 'disconnectMediator': {
      game.mediatorToken = null;
      await saveGame(game);
      return { success: true };
    }

    case 'endGame': {
      await redis.del(`game:${gameId}`);
      return { success: true, ended: true };
    }

    default:
      return { error: 'Unknown action' };
  }
}

// Auto-close buzzer after 5 seconds (called from poll endpoint)
export async function checkBuzzerTimeout(gameId) {
  const game = await redis.get(`game:${gameId}`);
  if (!game) return;

  if (game.buzzerState === 'open' && game.buzzerOpenedAt) {
    const elapsed = Date.now() - game.buzzerOpenedAt;
    if (elapsed >= 5000) {
      game.buzzerState = 'locked';
      await saveGame(game);
    }
  }
}
