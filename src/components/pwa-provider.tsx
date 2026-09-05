/*! EduElevate Coaching Management Service PWA Core v2.0.0 */
'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Download, X, RefreshCw, Bell, Smartphone, Laptop, CheckCircle2, Share2, Check } from 'lucide-react';
import { requestNotificationPermission, sendLocalPushNotification } from '@/lib/push-notifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showOfflineAlert, setShowOfflineAlert] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // 1. Check initial online and standalone state
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) {
        setShowOfflineAlert(true);
      }

      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      setIsInstalled(!!standalone);

      const handleOnline = () => {
        setIsOnline(true);
        setShowOfflineAlert(false);
      };

      const handleOffline = () => {
        setIsOnline(false);
        setShowOfflineAlert(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // 2. Register Service Worker with 100% Automatic Zero-Touch Updates
      if ('serviceWorker' in navigator) {
        let refreshing = false;

        // Auto-reload when new service worker takes over
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });

        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
            setSwRegistration(reg);

            // Force check for updates immediately on startup
            reg.update().catch(() => {});

            // Auto-poll for new deployments every 30 seconds
            const autoUpdateTimer = setInterval(() => {
              reg.update().catch(() => {});
            }, 30000);

            // Check updates whenever user returns to tab / window focus
            const handleVisibilityChange = () => {
              if (document.visibilityState === 'visible') {
                reg.update().catch(() => {});
              }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('focus', handleVisibilityChange);

            // Detect new updates and immediately instruct SW to skip waiting
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // New content available, automatically activate and refresh
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                  }
                });
              }
            });
            // Auto-sync Web Push subscription on every SW startup.
            // We ALWAYS force-unsubscribe and resubscribe so the server gets a
            // fresh, valid endpoint. Reusing stale endpoints is the #1 reason
            // push notifications silently fail on mobile (Chrome rotates endpoints).
            const syncPushSubscription = async () => {
              if (!('PushManager' in window) || !('Notification' in window)) return;
              if (Notification.permission !== 'granted') return;
              try {
                const res = await fetch('/api/notifications/vapid-key');
                const keyData = await res.json();
                if (!keyData?.publicKey) return;

                // Convert VAPID public key from URL-safe base64 → Uint8Array
                const clean = keyData.publicKey.trim();
                const padding = '='.repeat((4 - (clean.length % 4)) % 4);
                const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                  outputArray[i] = rawData.charCodeAt(i);
                }

                // Always unsubscribe first — prevents stale/410-expired endpoints
                // from staying on the server while the client thinks it's subscribed.
                const existingSub = await reg.pushManager.getSubscription();
                if (existingSub) {
                  try { await existingSub.unsubscribe(); } catch (_) {}
                }

                // Get a brand-new push subscription
                let sub: PushSubscription | null = null;
                try {
                  sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: outputArray
                  });
                } catch (subErr: any) {
                  // DOMException on slow mobile startup — retry once after 800ms
                  console.warn('[PWA Push] Subscribe failed, retrying in 800ms:', subErr?.message);
                  await new Promise(r => setTimeout(r, 800));
                  try {
                    sub = await reg.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: outputArray
                    });
                  } catch (retryErr) {
                    console.warn('[PWA Push] Subscribe retry also failed:', retryErr);
                    return;
                  }
                }

                if (!sub) return;

                // Resolve the authenticated user's role — use login_role / original_role
                // to avoid picking up a transient view-mode role (e.g. "View as Student").
                const user = localStorage.getItem('current_user');
                let role = 'ALL';
                let userId = 'device';
                try {
                  if (user) {
                    const parsed = JSON.parse(user);
                    role = parsed.login_role || parsed.original_role || parsed.role || 'ALL';
                    userId = parsed.username || parsed.id || 'device';
                  }
                } catch (_) {}

                // POST fresh subscription to server (upsert by endpoint is idempotent)
                await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.toJSON().keys?.p256dh,
                      auth: sub.toJSON().keys?.auth
                    },
                    role,
                    userId
                  })
                }).catch(() => {});

                console.log('[PWA Push] Subscription refreshed and synced to server ✓');
              } catch (e) {
                console.warn('[PWA Push] syncPushSubscription error:', e);
              }
            };

            syncPushSubscription();
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });

        // Listen for messages from active SW
        const handleSwMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'SW_UPDATED') {
            if (!refreshing) {
              refreshing = true;
              window.location.reload();
            }
          }
          if (event.data && event.data.type === 'NEW_BROADCAST') {
            window.dispatchEvent(new CustomEvent('giterp_broadcast', { detail: event.data.payload }));
          }
        };
        navigator.serviceWorker.addEventListener('message', handleSwMessage);
      }

      // 3. Listen for PWA Install Prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        const dismissed = sessionStorage.getItem('pwa_install_dismissed');
        if (!dismissed) {
          setShowInstallBanner(true);
        }
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // 4. Listen for Manual Trigger from App Topbar / Settings
      const handleManualTrigger = () => {
        if (deferredPrompt) {
          handleInstallClick();
        } else {
          setShowInstallGuide(true);
        }
      };
      window.addEventListener('trigger_pwa_install', handleManualTrigger);

      // 5. Listen for PWA installation completion
      const handleAppInstalled = async () => {
        console.log('[PWA] EduElevate App installed successfully');
        setIsInstalled(true);
        setShowInstallBanner(false);
        setShowInstallGuide(false);
        if ('Notification' in window && Notification.permission !== 'granted') {
          try {
            const perm = await requestNotificationPermission();
            if (perm === 'granted') {
              sendLocalPushNotification('🔔 EduElevate App Installed!', {
                body: 'Push notifications are now active for real-time coaching notices, attendance, and fee alerts.',
                urgent: true
              });
            }
          } catch (e) {}
        }
      };
      window.addEventListener('appinstalled', handleAppInstalled);

      // 6. If running as standalone installed PWA, prompt for notifications immediately
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isStandalone && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(async () => {
          try {
            const perm = await requestNotificationPermission();
            if (perm === 'granted') {
              sendLocalPushNotification('🔔 Notifications Active!', {
                body: 'You will receive real-time alerts on your home screen.',
                urgent: true
              });
            }
          } catch (e) {}
        }, 1000);
      }

      // Check notification permission after 2.5 seconds if default
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'default') {
          const dismissed = sessionStorage.getItem('pwa_notif_dismissed');
          if (!dismissed) {
            setShowNotificationBanner(true);
          }
        }
      }, 2500);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('trigger_pwa_install', handleManualTrigger);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstallGuide(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User response to install:', outcome);
    setDeferredPrompt(null);
    setShowInstallBanner(false);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      if ('Notification' in window && Notification.permission !== 'granted') {
        try {
          const perm = await requestNotificationPermission();
          if (perm === 'granted') {
            sendLocalPushNotification('🔔 Notifications Enabled!', {
              body: 'You will receive instant coaching circulars, test series scores, and center alerts.',
              urgent: true
            });
          }
        } catch (e) {}
      }
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setShowNotificationBanner(false);
    if (perm === 'granted') {
      sendLocalPushNotification('🔔 Notifications Enabled!', {
        body: 'You will receive real-time coaching alerts, batch schedules, and fee reminders.',
        urgent: true
      });
    }
  };

  const handleUpdateApp = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <>
      {children}

      {/* Floating Offline Notification Banner */}
      {showOfflineAlert && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#122A24] text-white border border-emerald-500/30 backdrop-blur-md px-5 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 text-xs sm:text-sm font-medium">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <WifiOff className="w-4 h-4 text-rose-300 shrink-0" />
          <span>Offline mode active. Running from cached register.</span>
          <button
            onClick={() => setShowOfflineAlert(false)}
            className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer border-none text-white bg-transparent"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Enable Push Notifications Banner */}
      {showNotificationBanner && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 flex items-center gap-3 bg-[#122A24] text-white border border-emerald-500/30 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-display font-bold text-white truncate">Enable Push Alerts</h4>
            <p className="text-[10.5px] text-slate-300 line-clamp-1">Receive test rankings, batch schedules &amp; fee dues.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleEnableNotifications}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer border-none"
            >
              Allow
            </button>
            <button
              onClick={() => {
                setShowNotificationBanner(false);
                sessionStorage.setItem('pwa_notif_dismissed', 'true');
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* App Update Available Toast */}
      {updateAvailable && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-[#122A24] text-white border border-emerald-500/40 backdrop-blur-md p-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-5 duration-300 text-sm max-w-sm">
          <RefreshCw className="w-5 h-5 text-emerald-400 shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="font-display font-semibold text-white">Update Available</p>
            <p className="text-xs text-slate-300">A new version of EduElevate is ready.</p>
          </div>
          <button
            onClick={handleUpdateApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border-none"
          >
            Update
          </button>
        </div>
      )}

      {/* Install PWA Prompt Banner */}
      {showInstallBanner && deferredPrompt && !isInstalled && (
        <div className="fixed bottom-5 right-4 sm:right-6 z-50 flex items-center gap-3.5 bg-[#122A24] text-white border border-emerald-500/40 backdrop-blur-xl p-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-emerald-500/30 shrink-0 shadow-md bg-[#0D1F1A] flex items-center justify-center p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="EduElevate Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-display font-semibold text-white truncate">Install EduElevate</h4>
            <p className="text-[11px] text-slate-300 line-clamp-1">Install to home screen or desktop for fast offline coaching access.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismissInstall}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Manual Install Instructions Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#122A24] text-white border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 transition-colors border-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#0D1F1A] border border-emerald-500/40 p-1.5 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192.png" alt="EduElevate" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-white">Install EduElevate App</h3>
                <p className="text-xs text-emerald-400 font-medium">Standalone Coaching Management Portal</p>
              </div>
            </div>

            {isInstalled ? (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">App is Already Installed!</p>
                <p className="text-xs text-slate-300 mt-1">
                  EduElevate is already running or installed on this device. You can open it anytime from your Applications menu or Home Screen.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 mb-6 text-xs text-slate-200">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <Laptop className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block mb-0.5">Desktop (Chrome / Edge / Brave):</span>
                    Look for the <span className="text-emerald-400 font-semibold font-mono">Install [⊕]</span> icon in your browser URL bar at the top right, or click browser menu (⋮) &rarr; <span className="text-white font-medium">"Install EduElevate"</span>.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block mb-0.5">Mobile (iOS / Safari):</span>
                    Tap the <span className="text-emerald-400 font-semibold">Share <Share2 className="w-3 h-3 inline" /></span> button in Safari at the bottom, scroll down and tap <span className="text-white font-medium">"Add to Home Screen"</span>.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block mb-0.5">Mobile (Android / Chrome):</span>
                    Tap the 3 dots (⋮) menu in Chrome, then tap <span className="text-white font-medium">"Install App"</span> or <span className="text-white font-medium">"Add to Home Screen"</span>.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer border-none shadow-md"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
