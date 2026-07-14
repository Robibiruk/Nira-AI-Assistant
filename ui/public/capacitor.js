// Local stub for the Capacitor bridge.
// In the browser (web/PWA build) this file stays as-is and does nothing —
// window.Capacitor remains undefined, so the app behaves as a normal web app.
// When `npx cap sync android` runs, Capacitor OVERWRITES this file in the
// built bundle with the real bridge that sets window.Capacitor and wires the
// native shell. Either way the module import is safe.
(function () {
  if (typeof window !== 'undefined' && !window.Capacitor) {
    // Expose a no-op so feature-detection (window.Capacitor.isNativePlatform)
    // returns false instead of throwing. The real bridge replaces this.
    window.Capacitor = window.Capacitor || {
      isNativePlatform: function () { return false },
    }
  }
})()
