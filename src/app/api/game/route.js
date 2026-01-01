import { NextResponse } from 'next/server';
import { createGame } from '@/lib/gameStore';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customQuestions } = body;

    const { gameId, hostToken } = await createGame(customQuestions || null);
    return NextResponse.json({ gameId, hostToken });
  } catch (error) {
    console.error('Create game error:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
