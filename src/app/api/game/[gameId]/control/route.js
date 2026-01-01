import { NextResponse } from 'next/server';
import { controlGame } from '@/lib/gameStore';

export async function POST(request, { params }) {
  const { gameId } = await params;
  const { hostToken, action, payload } = await request.json();

  if (!hostToken) {
    return NextResponse.json({ error: 'Host token is required' }, { status: 401 });
  }

  if (!action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 });
  }

  const result = controlGame(gameId, hostToken, action, payload || {});

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
