import { NextResponse } from 'next/server';
import { joinAsMediator, getMediatorGameState, checkBuzzerTimeout } from '@/lib/gameStore';

// POST - Join as mediator
export async function POST(request, { params }) {
  const { gameId } = await params;

  const result = await joinAsMediator(gameId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}

// GET - Poll for mediator state
export async function GET(request, { params }) {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const mediatorToken = searchParams.get('mediatorToken');

  if (!mediatorToken) {
    return NextResponse.json({ error: 'Mediator token required' }, { status: 401 });
  }

  // Check and auto-close buzzer if timeout
  await checkBuzzerTimeout(gameId);

  const state = await getMediatorGameState(gameId, mediatorToken);

  if (!state) {
    return NextResponse.json({ error: 'Invalid mediator token or game not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}
