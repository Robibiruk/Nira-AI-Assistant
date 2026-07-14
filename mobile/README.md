# Nira AI — Android app (Capacitor wrapper)

This folder turns the existing **Nira React + Vite web UI** (`../ui`) into a
native **Android app** using [Capacitor](https://capacitorjs.com) — no UI rewrite.
The backend (Render / FastAPI) is unchanged; the app just calls it from a WebView.

> iOS uses the same approach (Capacitor iOS). This folder is Android-first so you
> can sideload the APK without a Google Play Console account.

## What's here
```
mobile/
├── capacitor.config.json     # appId, appName, webDir=dist
├── package.json              # @capacitor/cli + @capacitor/android
└── android/                  # native Android project (open in Android Studio)
    ├── app/src/main/...      # MainActivity, Manifest, resources, icons
    ├── build.gradle          # AGP 8.2 / compileSdk 34
    └── gradle/wrapper/       # Gradle 8.5 wrapper
```

## Prerequisites (on your machine, not this dev env)
- **Node.js 18+**
- **Java 17** (JDK)
- **Android SDK** (via Android Studio) with a platform + build-tools
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` set

## Build & run (from this `mobile/` folder)
```bash
# 1. Install mobile deps
npm install

# 2. Build the web UI and copy it into android/app/src/main/assets/public
npm run build:web      # builds ../ui -> ../ui/dist
npx cap sync android   # copies dist into the native project

# 3a. Sideload a debug APK (no Play account needed)
npx cap build android  # or, in android/: ./gradlew assembleDebug
#    -> android/app/build/outputs/apk/debug/app-debug.apk  (install via adb)

# 3b. Or open in Android Studio to run on an emulator / device
npx cap open android
```

## How the app reaches the backend
`../ui/src/api.js` detects the native shell (`window.Capacitor.isNativePlatform()`)
and points at the Render backend:
- `VITE_API_BASE` if set, else
- `Capacitor.getServerUrl()`, else
- `https://nira-ai-backend-kzbo.onrender.com` (hardcoded fallback).

The PWA service worker is **disabled** inside the native shell (`../ui/src/main.jsx`)
so it doesn't interfere with the WebView bundle.

## Permissions granted (AndroidManifest.xml)
INTERNET, ACCESS_NETWORK_STATE, RECORD_AUDIO (voice), CAMERA, READ_MEDIA_IMAGES,
POST_NOTIFICATIONS. Cleartext traffic is disabled (`usesCleartextTraffic=false`).

## Publishing later (optional)
- **Google Play**: $25 one-time; build `./gradlew bundleRelease`, upload to Play Console.
- **Direct distributon**: the debug/release APK installs on any Android 8+ device.

Backend, AI providers, memory, OAuth and all features are identical to the web app.
