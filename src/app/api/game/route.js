import { NextResponse } from 'next/server';
import { createGame } from '@/lib/gameStore';

export async function POST() {
  const { gameId, hostToken } = createGame();
  return NextResponse.json({ gameId, hostToken });
}
