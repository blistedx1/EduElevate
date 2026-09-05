/*! Giterp Multi-School Enterprise ERP Core v1.2.0 */

export const APP_INFO = {
  name: 'EduElevate Coaching Management Platform',
  shortName: 'EduElevate',
  version: '2.0.0',
  buildNumber: '2026.09.05.201',
  buildTimestamp: '2026-09-05T23:48:00+05:30',
  releaseDate: '05 Sep 2026',
  releaseTag: 'v2.0.0-coaching.201',
  engine: 'Next.js 16.3 (Turbopack) • MongoDB Atlas • Coaching Suite • PWA Push',
  status: 'LIVE_PRODUCTION'
};

export function getAppBuildString(): string {
  return `Build #${APP_INFO.buildNumber} (${APP_INFO.releaseTag})`;
}

export async function forcePurgeAppCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    }
    window.location.reload();
  } catch (e) {
    window.location.reload();
  }
}
