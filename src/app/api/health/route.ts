import { NextResponse } from 'next/server';

/**
 * Instant health check for Render's deploy gating. No database or external
 * calls — a new instance must report healthy immediately so traffic swaps
 * with zero downtime (the old /api/fx check depended on an external FX API
 * and delayed swaps by minutes, causing 502 windows after each deploy).
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
