/*! EduElevate Coaching Management Service Core v2.0.0 */
import { Pool, QueryResult } from 'pg';
import {
  MediaVaultItem,
  saveMediaVaultFile as saveLocalMediaVaultFile,
  getMediaVaultFile as getLocalMediaVaultFile,
  deleteMediaVaultFile as deleteLocalMediaVaultFile
} from './media';

export type { MediaVaultItem };

function getConnectionString(): string {
  const raw = process.env.COCKROACH_DB_URL || process.env.DATABASE_URL || '';
  return raw.replace('?sslmode=verify-full', '').replace('&sslmode=verify-full', '');
}

export function isCockroachConfigured(): boolean {
  const cs = getConnectionString();
  return Boolean(
    cs && 
    (cs.startsWith('postgresql://') || cs.startsWith('postgres://')) &&
    !cs.includes('disabled')
  );
}

let pool: Pool | null = null;

export function getCockroachPool(): Pool | null {
  if (!isCockroachConfigured()) {
    return null;
  }

  if (!pool) {
    const connectionString = getConnectionString();
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    });

    pool.on('error', (err) => {
      console.error('[CockroachDB] Unexpected client error on idle pool:', err.message);
    });
  }

  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T> | null> {
  const p = getCockroachPool();
  if (!p) return null;
  try {
    return await p.query<T>(text, params);
  } catch (err: any) {
    console.error('[CockroachDB] Query error:', err.message, '\nQuery:', text);
    throw err;
  }
}

export async function queryRows<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getCockroachPool();
  if (!p) return [];
  try {
    const res = await p.query<T>(text, params);
    return res.rows;
  } catch (err: any) {
    console.error('[CockroachDB] Query error:', err.message, '\nQuery:', text);
    throw err;
  }
}

export async function checkCockroachStatus(): Promise<{ connected: boolean; error: string | null; dbVersion?: string; uriMasked: string }> {
  const raw = process.env.COCKROACH_DB_URL || process.env.DATABASE_URL || '';
  const uriMasked = raw ? raw.replace(/:([^@]+)@/, ':****@') : 'Not Configured';

  if (!isCockroachConfigured()) {
    return {
      connected: false,
      error: 'COCKROACH_DB_URL or DATABASE_URL not configured',
      uriMasked
    };
  }

  try {
    const res = await query('SELECT version();');
    const dbVersion = res?.rows[0]?.version || 'CockroachDB Serverless';
    return {
      connected: true,
      error: null,
      dbVersion,
      uriMasked
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message,
      uriMasked
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📸 COCKROACHDB DEDICATED MEDIA VAULT (With Local Fallback)
// ─────────────────────────────────────────────────────────────────────────────
export async function saveMediaVaultFile(item: MediaVaultItem): Promise<boolean> {
  // Always write to local storage as high-speed instant disk fallback
  await saveLocalMediaVaultFile(item);

  if (!isCockroachConfigured()) {
    return true;
  }

  const sizeBytes = item.size_bytes || Buffer.byteLength(item.data, 'utf8');
  try {
    await query(`
      INSERT INTO media_vault (id, school_id, entity_type, entity_id, filename, mime_type, size_bytes, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        size_bytes = EXCLUDED.size_bytes,
        mime_type = EXCLUDED.mime_type;
    `, [
      item.id,
      item.school_id || 'DPS2026',
      item.entity_type || 'GENERAL',
      item.entity_id || '',
      item.filename || 'media',
      item.mime_type || 'image/jpeg',
      sizeBytes,
      item.data
    ]);
    return true;
  } catch (e: any) {
    console.warn('[CockroachDB Media Vault] Notice saving media to cloud:', e.message);
    return true; // Local backup succeeded
  }
}

export async function getMediaVaultFile(id: string): Promise<MediaVaultItem | null> {
  // 1. Try CockroachDB
  if (isCockroachConfigured()) {
    try {
      const res = await query<MediaVaultItem>('SELECT * FROM media_vault WHERE id = $1 LIMIT 1;', [id]);
      if (res && res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (e: any) {
      console.warn('[CockroachDB Media Vault] Reading from local backup due to note:', e.message);
    }
  }

  // 2. Fallback to local
  return await getLocalMediaVaultFile(id);
}

export async function deleteMediaVaultFile(id: string): Promise<boolean> {
  await deleteLocalMediaVaultFile(id);
  if (isCockroachConfigured()) {
    try {
      await query('DELETE FROM media_vault WHERE id = $1;', [id]);
    } catch (e: any) {
      // Non-blocking
    }
  }
  return true;
}
