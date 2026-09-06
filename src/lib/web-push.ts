/*! EduElevate Coaching Management Service Core v2.0.0 */
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { query as cockroachQuery, isCockroachConfigured } from '@/lib/cockroach';

// File path for storing subscriptions and broadcast logs locally as fallback
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'data', 'push_subscriptions.json');
const BROADCASTS_FILE = path.join(process.cwd(), 'data', 'broadcast_notifications.json');

// VAPID Keys Setup — must match keys used at subscription time on the client
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHAg7KTZHvAhm0LMuGHYP57KKiM2qXLu8IveV4ol8VAZET5ThLx2voemwGgh-I8j6Ksoz1A8S-_5cVMensJVmC4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'LqnxejcqqbxP1AinhpXudn0RXxb_YtBD5t08Y41HtVM';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:emmalover4317@gmail.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('[WebPush] Notice during VAPID setup:', err);
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  role?: string;
  userId?: string;
  class_name?: string;
  createdAt: string;
}

export interface BroadcastRecord {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: string;
  urgent: boolean;
  senderName?: string;
  senderRole?: string;
  deliveredCount: number;
  timestamp: string;
  createdAt: string;
}

// Read saved push subscriptions from CockroachDB (with local JSON fallback)
export async function getSavedSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (isCockroachConfigured()) {
    try {
      const res = await cockroachQuery<any>('SELECT * FROM push_subscriptions ORDER BY created_at DESC;');
      if (res && res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          id: r.id,
          endpoint: r.endpoint,
          keys: {
            p256dh: r.p256dh,
            auth: r.auth
          },
          role: r.role,
          userId: r.user_id,
          class_name: r.class_name || 'ALL',
          createdAt: r.created_at
        }));
      }
    } catch (e: any) {
      console.warn('[WebPush] CockroachDB read notice:', e.message);
    }
  }

  // Fallback to local file
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}

  return [];
}

// Save or update subscription in CockroachDB & local file
export async function saveSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  role?: string;
  userId?: string;
  class_name?: string;
}): Promise<boolean> {
  const record: PushSubscriptionRecord = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    endpoint: sub.endpoint,
    keys: sub.keys,
    role: sub.role || 'ALL',
    userId: sub.userId,
    class_name: sub.class_name,
    createdAt: new Date().toISOString()
  };

  let savedInDb = false;

  if (isCockroachConfigured()) {
    try {
      await cockroachQuery(`
        INSERT INTO push_subscriptions (id, school_id, user_id, role, endpoint, p256dh, auth, device_info)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (endpoint) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          role = EXCLUDED.role,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth;
      `, [
        record.id, 'DPS2026', record.userId || '', record.role || 'ALL',
        record.endpoint, record.keys?.p256dh || '', record.keys?.auth || '',
        JSON.stringify({})
      ]);
      savedInDb = true;
    } catch (e: any) {
      console.warn('[WebPush] CockroachDB save notice:', e.message);
    }
  }

  // Save to local JSON as well
  try {
    let list: PushSubscriptionRecord[] = [];
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
      } catch (e) {}
    }
    const existingIndex = list.findIndex(s => s.endpoint === sub.endpoint);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...record, id: list[existingIndex].id };
    } else {
      list.push(record);
    }

    const dir = path.dirname(SUBSCRIPTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return savedInDb;
  }
}

// Read saved broadcast notifications
export async function getBroadcastHistory(limit = 30): Promise<BroadcastRecord[]> {
  try {
    if (fs.existsSync(BROADCASTS_FILE)) {
      const data = fs.readFileSync(BROADCASTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, limit);
      }
    }
  } catch (e) {}

  return [];
}

// Save a broadcast notification to history
export async function saveBroadcastRecord(record: BroadcastRecord): Promise<void> {
  try {
    let list: BroadcastRecord[] = [];
    if (fs.existsSync(BROADCASTS_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf-8'));
      } catch (e) {}
    }
    list.unshift(record);
    const dir = path.dirname(BROADCASTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BROADCASTS_FILE, JSON.stringify(list.slice(0, 100), null, 2), 'utf-8');
  } catch (e) {}
}

// Dispatch Web Push notification to all subscribers or targeted audience
export async function sendWebPushNotification({
  title,
  body,
  url = '/app',
  audience = 'ALL',
  urgent = false,
  senderName = 'Coaching Administration',
  senderRole = 'PRINCIPAL'
}: {
  title: string;
  body: string;
  url?: string;
  audience?: string;
  urgent?: boolean;
  senderName?: string;
  senderRole?: string;
}): Promise<{ sent: number; failed: number; total: number }> {
  const subscriptions = await getSavedSubscriptions();

  // Filter subscriptions based on audience target
  const targetSubs = subscriptions.filter(sub => {
    if (audience === 'ALL') return true;
    if (audience === 'TEACHERS' && sub.role === 'TEACHER') return true;
    if (audience === 'STUDENTS' && (sub.role === 'STUDENT' || sub.role === 'PARENT')) return true;
    if (audience === 'ADMINS' && (sub.role === 'PRINCIPAL' || sub.role === 'ADMIN' || sub.role === 'AGENCY_SUPERADMIN')) return true;
    return false;
  });

  const payload = JSON.stringify({
    title,
    body,
    url,
    urgent,
    senderName,
    senderRole,
    timestamp: new Date().toISOString(),
    icon: '/icon-192.png',
    badge: '/badge-72.png'
  });

  const results = { sent: 0, failed: 0, total: targetSubs.length };
  const deadEndpoints: string[] = [];

  for (const sub of targetSubs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys
        },
        payload
      );
      results.sent++;
    } catch (error: any) {
      results.failed++;
      console.warn(`[WebPush] Failed to send to ${sub.endpoint.slice(0, 35)}...`, error?.statusCode || error?.message);
      
      // If subscription expired or gone (410 Gone / 404), mark for removal
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        deadEndpoints.push(sub.endpoint);
      }
    }
  }

  // Prune dead subscriptions from CockroachDB & local file
  if (deadEndpoints.length > 0) {
    if (isCockroachConfigured()) {
      try {
        await cockroachQuery('DELETE FROM push_subscriptions WHERE endpoint = ANY($1);', [deadEndpoints]);
      } catch (e) {}
    }

    try {
      const activeSubs = subscriptions.filter(s => !deadEndpoints.includes(s.endpoint));
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(activeSubs, null, 2), 'utf-8');
    } catch (e) {}
  }

  // Record this broadcast to history
  const broadcastLog: BroadcastRecord = {
    id: `bc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title,
    body,
    url,
    audience,
    urgent,
    senderName,
    senderRole,
    deliveredCount: results.sent,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString()
  };
  await saveBroadcastRecord(broadcastLog);

  return results;
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}
