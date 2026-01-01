import { NextResponse } from 'next/server';
import { getPublicGameState, getHostGameState, checkBuzzerTimeout } from '@/lib/gameStore';

export async function GET(request, { params }) {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const hostToken = searchParams.get('hostToken');
  const playerId = searchParams.get('playerId');

  // Check and auto-close buzzer if timeout
  await checkBuzzerTimeout(gameId);

  let state;
  if (hostToken) {
    state = await getHostGameState(gameId, hostToken);
  } else {
    state = await getPublicGameState(gameId, playerId);
  }

  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}
