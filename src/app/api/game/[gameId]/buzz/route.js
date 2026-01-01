import { NextResponse } from 'next/server';
import { buzz } from '@/lib/gameStore';

export async function POST(request, { params }) {
  const { gameId } = await params;
  const { playerId } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
  }

  const result = await buzz(gameId, playerId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
