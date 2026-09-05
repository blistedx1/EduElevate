/*! EduElevate Coaching Management Service Core v2.0.0 */
import { NextResponse } from 'next/server';
import { APP_INFO } from '@/lib/app-info';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    ...APP_INFO,
    serverTime: new Date().toISOString()
  });
}
