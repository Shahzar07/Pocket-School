import { NextResponse } from 'next/server';

/** The browser cannot see its own public IP. The signature stores this value. */
export function GET(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
  return NextResponse.json({ ip });
}
