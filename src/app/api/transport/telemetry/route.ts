import { NextResponse } from 'next/server';
import { query as cockroachQuery, isCockroachConfigured } from '@/lib/cockroach';

export interface TelemetryPayload {
  routeId: string;
  vehicleNo?: string;
  driver?: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  accuracyMeters: number;
  active: boolean;
  timestamp: number;
  lastUpdatedText?: string;
}

// In-memory fallback telemetry cache
const memoryStore = new Map<string, TelemetryPayload>();

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId');

    const now = Date.now();
    const timeoutMs = 25000; // Consider offline if no ping in 25s

    // Read from CockroachDB Serverless
    if (isCockroachConfigured()) {
      try {
        if (routeId) {
          const res = await cockroachQuery<any>('SELECT * FROM transport_telemetry WHERE bus_id = $1 LIMIT 1;', [routeId]);
          if (res && res.rows && res.rows.length > 0) {
            const row = res.rows[0];
            const ts = new Date(row.timestamp).getTime();
            const isOnline = now - ts < timeoutMs && row.status !== 'STOPPED';
            return NextResponse.json({
              success: true,
              routeId,
              isOnline,
              telemetry: {
                routeId: row.bus_id,
                vehicleNo: 'UP-32-AB-9876',
                driver: row.driver_phone || 'Driver',
                latitude: Number(row.lat) || 0,
                longitude: Number(row.lng) || 0,
                speedKmh: Number(row.speed) || 0,
                heading: Number(row.heading) || 0,
                accuracyMeters: 5,
                active: row.status !== 'STOPPED',
                timestamp: ts,
                lastUpdatedText: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            });
          }
        } else {
          const res = await cockroachQuery<any>('SELECT * FROM transport_telemetry ORDER BY timestamp DESC;');
          if (res && res.rows && res.rows.length > 0) {
            const all: Record<string, TelemetryPayload & { isOnline: boolean }> = {};
            for (const row of res.rows) {
              const ts = new Date(row.timestamp).getTime();
              all[row.bus_id] = {
                routeId: row.bus_id,
                vehicleNo: 'UP-32-AB-9876',
                driver: row.driver_phone || 'Driver',
                latitude: Number(row.lat) || 0,
                longitude: Number(row.lng) || 0,
                speedKmh: Number(row.speed) || 0,
                heading: Number(row.heading) || 0,
                accuracyMeters: 5,
                active: row.status !== 'STOPPED',
                timestamp: ts,
                lastUpdatedText: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOnline: (now - ts < timeoutMs && row.status !== 'STOPPED')
              };
            }
            return NextResponse.json({ success: true, telemetries: all });
          }
        }
      } catch (e: any) {
        console.warn('[Telemetry CockroachDB Notice]', e.message);
      }
    }

    // In-memory fallback
    if (routeId) {
      const data = memoryStore.get(routeId);
      const isOnline = data ? (now - data.timestamp < timeoutMs && data.active) : false;
      return NextResponse.json({
        success: true,
        routeId,
        isOnline,
        telemetry: data || null
      });
    }

    const all: Record<string, TelemetryPayload & { isOnline: boolean }> = {};
    for (const [rId, tData] of memoryStore.entries()) {
      all[rId] = {
        ...tData,
        isOnline: (now - tData.timestamp < timeoutMs && tData.active)
      };
    }

    return NextResponse.json({
      success: true,
      telemetries: all
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      routeId,
      vehicleNo,
      driver,
      latitude,
      longitude,
      speedKmh,
      heading,
      accuracyMeters,
      active = true
    } = body;

    if (!routeId) {
      return NextResponse.json({ success: false, error: 'routeId is required' }, { status: 400 });
    }

    const payload: TelemetryPayload = {
      routeId,
      vehicleNo: vehicleNo || 'UP-32-AB-9876',
      driver: driver || 'Ramesh Yadav',
      latitude: Number(latitude) || 26.8467,
      longitude: Number(longitude) || 80.9462,
      speedKmh: Number(speedKmh) || 0,
      heading: Number(heading) || 0,
      accuracyMeters: Number(accuracyMeters) || 5,
      active: Boolean(active),
      timestamp: Date.now(),
      lastUpdatedText: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Update in-memory fallback
    memoryStore.set(routeId, payload);

    // Persist to CockroachDB Cloud
    if (isCockroachConfigured()) {
      try {
        await cockroachQuery(`
          INSERT INTO transport_telemetry (bus_id, school_id, route_name, lat, lng, speed, heading, status, driver_phone)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (bus_id) DO UPDATE SET
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            speed = EXCLUDED.speed,
            heading = EXCLUDED.heading,
            status = EXCLUDED.status,
            timestamp = CURRENT_TIMESTAMP;
        `, [
          routeId, 'DPS2026', routeId, payload.latitude, payload.longitude,
          payload.speedKmh, payload.heading, payload.active ? 'IN_TRANSIT' : 'STOPPED', ''
        ]);
      } catch (e: any) {
        console.warn('[Telemetry CockroachDB Sync Notice]', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Telemetry broadcast received successfully',
      payload
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
