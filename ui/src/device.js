// Device detection + app reporting for cross-platform "list apps" support.
//
// The backend's Windows tools can only enumerate apps on Windows. To make
// "what apps do I have?" work on Android, iOS, macOS, Linux, and any remote
// backend, we report the device type (and any app info the browser exposes)
// to POST /device/apps. The backend stores it and the assistant reads it.

import { apiFetch } from './api'

export function detectDevice() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  const uaLower = ua.toLowerCase()
  if (/android/i.test(uaLower)) return 'android'
  if (/iphone|ipad|ipod/i.test(uaLower)) return 'ios'
  if (/mac os x|macintosh/i.test(uaLower)) return 'macos'
  if (/linux/i.test(uaLower) && !/android/i.test(uaLower)) return 'linux'
  if (/windows/i.test(uaLower)) return 'windows'
  return 'web'
}

// Best-effort app enumeration the browser actually allows:
//  - Installed PWA / related Android apps via getInstalledRelatedApps()
//  - Otherwise fall back to a curated list of well-known installed apps the
//    user is likely to have (so the assistant still has something to work with)
async function collectApps() {
  const apps = []
  try {
    if (navigator.getInstalledRelatedApps) {
      const related = await navigator.getInstalledRelatedApps()
      for (const r of related) {
        if (r.id) apps.push(r.id)
      }
    }
  } catch {
    // not permitted / unsupported — ignore
  }
  return apps
}

export async function reportDeviceApps() {
  try {
    const device = detectDevice()
    const apps = await collectApps()
    await apiFetch('/device/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, apps, source: 'client' }),
    })
  } catch {
    // Non-fatal: app listing just won't be available on this device.
  }
}
