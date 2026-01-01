import { NextResponse } from 'next/server';
import { joinGame, getGame } from '@/lib/gameStore';

export async function POST(request, { params }) {
  const { gameId } = await params;
  const { playerName } = await request.json();

  if (!playerName || playerName.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const game = getGame(gameId);
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const result = joinGame(gameId, playerName.trim());

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
