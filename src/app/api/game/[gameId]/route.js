import { NextResponse } from 'next/server';
import { getPublicGameState } from '@/lib/gameStore';

export async function GET(request, { params }) {
  const { gameId } = await params;
  const state = await getPublicGameState(gameId);

  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}
