# Android Deployment Plan — Card Advisor

## Structure

Two independent projects — iOS stays as-is, Android is created fresh:

```
mobile/           ← iOS project (never touched)
mobile-android/   ← Android project (created new)
```

`mobile-android/` is a brand new Expo project configured for Android only. The screen code, lib files, and assets are copied from `mobile/` since they're identical — but all config files (`app.json`, `package.json`, `eas.json`) are written fresh for Android.

---

## How Deployment Works (Plain English)

The web app (Next.js) already runs on Vercel and does all the heavy lifting — the database, the card recommendations, the merchant search. The Android app is just a thin front-end that talks to it. So "deploying to Android" doesn't mean moving any server code — it just means packaging the mobile screens into a format Android can install.

Here's the full journey:

**1. Development (Expo Go)**
You run the Android project on your laptop (`npx expo start`), and it broadcasts a QR code over your Wi-Fi. You scan that QR code with the free Expo Go app on your Android phone. Your phone downloads the app code directly from your laptop and runs it instantly. No building, no installing — it just works. This is how you test changes during development.

**2. Building a real app (EAS Build)**
Expo Go is great for development but it's not a standalone app — it needs your laptop running. To get a real installable app, you send the code to Expo's free cloud build service (EAS). Their servers compile it into an `.apk` file (an Android app package), which takes about 10–15 minutes. They then give you a download link.

**3. Getting it onto your phone**
- **Sideload (free):** You download the `.apk` from the link EAS gives you, transfer it to your phone (via Google Drive, USB, etc.), and install it directly. Android will ask you to allow "Install from unknown sources" the first time. After that it works like any other app — no Expo Go needed.
- **Play Store Internal Testing (~$25 one-time):** Instead of an `.apk`, EAS builds an `.aab` file (the Play Store format). You upload that to your Google Play Console, mark it as Internal Testing with only your Gmail as an allowed tester. The Play Store then lets you install it on your phone via a private link — it works exactly like installing any normal app, with automatic updates when you push a new build.

**What stays the same regardless of method:**
The Vercel backend and Supabase database don't change at all. The Android app just calls the same APIs the web app and iOS app use. No new server, no new database, nothing to configure on the backend.

---

## Your Options

| Method | Cost | How It Works |
|---|---|---|
| **Expo Go** | Free | Install Expo Go app → scan QR → app runs instantly. Best for testing. |
| **Sideloaded APK** | Free | Build a standalone `.apk`, transfer to device, install. No store involved. |
| **Play Store (Internal Testing)** | ~$25 USD one-time | App in your Play Store account, visible only to you. Cleaner install + OTA updates. |

**Recommended path:** Expo Go first to validate Android works, then decide between sideload (free) or Play Store Internal Testing (~₹2,100 one-time).

> **India note:** Google Play Developer registration is $25 USD paid in INR at the current rate. The Internal Testing track lets you be the sole tester — the app is never publicly discoverable.

---

## Setup Steps

### Step 1 — Create the new Android project directory

```bash
mkdir mobile-android
```

### Step 2 — Copy only the source code from the iOS project

These folders contain screen code, API logic, and assets — identical between iOS and Android:

```bash
cp -r mobile/app    mobile-android/app
cp -r mobile/lib    mobile-android/lib
cp -r mobile/constants mobile-android/constants
cp -r mobile/assets mobile-android/assets
```

### Step 3 — Create `app.json` (Android-only, written fresh)

New file at `mobile-android/app.json`:

```json
{
  "expo": {
    "name": "Card Advisor",
    "slug": "card-advisor-android",
    "scheme": "cardadvisor",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "com.nikhil.cardadvisor.android",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Used to find nearby merchants.",
          "android": {
            "locationWhenInUsePermission": "Used to find nearby merchants."
          }
        }
      ]
    ]
  }
}
```

### Step 4 — Create `package.json` (written fresh, same deps as iOS project)

New file at `mobile-android/package.json`:

```json
{
  "name": "card-advisor-android",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "build:preview": "eas build --platform android --profile preview",
    "build:production": "eas build --platform android --profile production"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.1.2",
    "@supabase/supabase-js": "^2.50.0",
    "expo": "~54.0.33",
    "expo-location": "~18.1.5",
    "expo-router": "~4.0.23",
    "expo-secure-store": "~14.0.1",
    "expo-status-bar": "~2.2.3",
    "react": "19.0.0",
    "react-native": "0.79.5",
    "react-native-url-polyfill": "^2.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~19.0.10",
    "typescript": "~5.8.3"
  }
}
```

### Step 5 — Create `tsconfig.json`

New file at `mobile-android/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

### Step 6 — Create `eas.json`

New file at `mobile-android/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### Step 7 — Create `.env`

Copy your Supabase credentials (same values as `mobile/.env`):

```bash
cp mobile/.env mobile-android/.env
```

### Step 8 — Install dependencies

```bash
cd mobile-android
npm install
```

---

## Running & Building

### Phase 1 — Expo Go (do this first, ~30 min)

Install **Expo Go** from the Play Store on your Android phone.

```bash
cd mobile-android
npx expo start
```

Scan the QR code. Confirm login, wallet, search, location, and recommendations all work. **Validate before building anything.**

---

### Phase 2A — Sideload APK (free)

```bash
# One-time EAS setup (free account at expo.dev)
npx eas login
npx eas init

# Store Supabase env vars as EAS secrets (baked in at build time)
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <your-url>
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <your-anon-key>

# Build APK (~10–15 min cloud build, free tier = 30 builds/month)
npx eas build --platform android --profile preview
```

EAS gives you a download link for the `.apk`. Transfer to your phone (USB, Google Drive, etc.). On Android: Settings → Security → enable "Install unknown apps" → install.

---

### Phase 2B — Play Store Internal Testing (~$25 one-time, optional)

If you want a cleaner install via Play Store with automatic updates:

1. Register at [play.google.com/console/signup](https://play.google.com/console/signup) — $25 USD one-time
2. Build: `npx eas build --platform android --profile production`
3. In Play Console: Create app → Internal Testing track → upload `.aab` → add your Gmail as the sole tester → publish

The app is never publicly searchable. Only your Gmail can install it via the Play Store link.

---

## Verification Checklist

- [ ] Login screen loads; email/password auth works
- [ ] Session persists after closing and reopening the app
- [ ] Wallet tab shows saved cards
- [ ] Home search returns merchant results
- [ ] Location permission prompt appears on first use
- [ ] Nearby tab finds merchants around current location
- [ ] Recommendation page loads the correct card suggestion

Test auth first — it's the most likely Android-specific failure point.

---

## Files Created (nothing in `mobile/` is touched)

| File | Action |
|---|---|
| `mobile-android/app/` | Copied from `mobile/app/` |
| `mobile-android/lib/` | Copied from `mobile/lib/` |
| `mobile-android/constants/` | Copied from `mobile/constants/` |
| `mobile-android/assets/` | Copied from `mobile/assets/` |
| `mobile-android/app.json` | New — Android-only config |
| `mobile-android/package.json` | New — same deps, Android scripts |
| `mobile-android/tsconfig.json` | New |
| `mobile-android/eas.json` | New — EAS build profiles |
| `mobile-android/.env` | Copied from `mobile/.env` |
