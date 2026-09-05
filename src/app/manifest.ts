/*! Giterp Multi-School Enterprise ERP Core v1.2.0 */
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduElevate — Coaching Management Service',
    short_name: 'EduElevate',
    description: 'Enterprise Coaching Management Platform for batches, test series, DPP, attendance, fee collection and branch management.',
    start_url: '/app',
    id: '/app',
    display: 'standalone',
    background_color: '#122A24',
    theme_color: '#122A24',
    orientation: 'portrait-primary',
    scope: '/',
    categories: ['education', 'productivity', 'business'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Coaching Dashboard',
        short_name: 'Dashboard',
        description: 'Open the Coaching Management Workspace',
        url: '/app',
        icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Branch Hub',
        short_name: 'Branches',
        description: 'Super Admin Multi-Branch Hub',
        url: '/agency',
        icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Login',
        short_name: 'Login',
        description: 'Sign into coaching portal',
        url: '/login',
        icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
      },
    ],
  };
}
