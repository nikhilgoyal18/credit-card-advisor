# iOS Deployment Plan — Credit Card Advisor

**Date:** 2026-04-12  
**Approach:** React Native (Expo) · Reuse existing Next.js API · Personal device via Expo Go / Xcode sideload

---

## TL;DR

Build a React Native app using Expo that calls the existing Next.js API deployed on Vercel. Auth is handled by Supabase directly from the mobile client. For personal use on your own iPhone, no Apple Developer account purchase is required — Expo Go covers day-to-day development and testing, and Xcode sideloading works for a standalone build.

---

## Architecture

```
iPhone (Expo React Native app)
        │
        │  HTTPS REST calls (same endpoints as the web app)
        ▼
Next.js API on Vercel  (existing: /api/recommend, /api/merchants/*)
        │
        ▼
Supabase (Postgres + Auth)
```

The mobile app is a **thin client** — all business logic lives on the server. No duplicate logic to maintain.

---

## Apple Account Reality Check

| Goal | Account required | Cost |
|------|-----------------|------|
| Run on your iPhone via Expo Go | Free Apple ID | $0 |
| Sideload a standalone IPA via Xcode | Free Apple ID | $0 — but cert expires every **7 days**, must re-sign |
| Share via TestFlight | Apple Developer Program | $99/yr |
| App Store distribution | Apple Developer Program | $99/yr |

**Recommendation for now:** Use Expo Go. It is a free app from the App Store that runs your Expo project instantly over your local network or via Expo's cloud tunnel. Zero build steps, zero certificates. Upgrade to the paid program only if you want TestFlight or App Store distribution later.

---

## Phase 1 — Deploy the Web API to Vercel

*Prerequisite: the iOS app needs a live URL to call. If it's already deployed, skip to Phase 2.*

### 1.1 Vercel deployment
```bash
cd app
npx vercel deploy --prod
```

### 1.2 Environment variables in Vercel dashboard
Set these in Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (if used server-side)

### 1.3 Enable CORS for mobile clients
The Next.js API routes need to accept requests from the Expo app.  
Add a `next.config.ts` header rule or a middleware response header:

```ts
// In next.config.ts or middleware.ts
// Allow calls from Expo dev client (localhost / Expo tunnel)
headers: [
  {
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
    ],
  },
]
```

> **Note:** For production, tighten `Allow-Origin` to your Vercel domain. The wildcard is fine during development.

### 1.4 Supabase: add mobile URL to allowed redirects
In Supabase Dashboard → Auth → URL Configuration:
- Add `exp://` schemes and your Vercel URL to **Redirect URLs**.

---

## Phase 2 — Create the Expo Project

### 2.1 Scaffold
```bash
# From the repo root (next to the /app folder)
npx create-expo-app mobile --template blank-typescript
cd mobile
```

This creates `mobile/` alongside `app/` (the Next.js project).

### 2.2 Install core dependencies
```bash
npx expo install \
  expo-router \
  @supabase/supabase-js \
  @react-native-async-storage/async-storage \
  expo-secure-store \
  expo-location \
  expo-status-bar \
  react-native-safe-area-context \
  react-native-screens \
  @expo/vector-icons
```

### 2.3 Directory structure
```
mobile/
├── app/                     # Expo Router file-based routing (mirrors Next.js App Router)
│   ├── _layout.tsx          # Root layout (auth gate)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigator
│   │   ├── index.tsx        # Home / merchant search
│   │   └── wallet.tsx       # Card wallet
│   └── recommend/
│       └── [merchantId].tsx # Recommendation screen
├── lib/
│   ├── supabase.ts          # Supabase client (AsyncStorage session)
│   ├── api.ts               # Typed wrappers for Next.js API calls
│   └── types.ts             # Shared TypeScript types
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── CardTile.tsx
│   └── RecommendationCard.tsx
├── constants/
│   └── api.ts               # BASE_URL pointing to Vercel deployment
└── app.json
```

### 2.4 Configure `app.json`
```json
{
  "expo": {
    "name": "Card Advisor",
    "slug": "card-advisor",
    "scheme": "cardadvisor",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourname.cardadvisor",
      "supportsTablet": false
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        { "locationWhenInUsePermission": "Used to find nearby merchants." }
      ]
    ]
  }
}
```

---

## Phase 3 — Supabase Auth in React Native

The existing web app uses Supabase cookie-based auth via `@supabase/ssr`. React Native cannot use cookies — sessions are stored in `AsyncStorage` instead.

### 3.1 Supabase client (`lib/supabase.ts`)
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // Required for React Native
  },
});
```

### 3.2 Environment variables
Create `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_BASE_URL=https://your-app.vercel.app
```

> **Security:** `EXPO_PUBLIC_` variables are bundled into the app binary — only put anon/public keys here. Never put `SERVICE_ROLE_KEY` in the mobile app.

### 3.3 Auth guard in root layout (`app/_layout.tsx`)
```tsx
import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<null | object>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)/login');
    if (session && inAuthGroup) router.replace('/(tabs)/');
  }, [session, loading, segments]);

  return <Slot />;
}
```

---

## Phase 4 — API Client (`lib/api.ts`)

All calls go through the deployed Next.js API. The Supabase session JWT is forwarded as a `Bearer` token so the API routes can authenticate the user.

```ts
import { supabase } from './supabase';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function searchMerchants(query: string) {
  const res = await fetch(
    `${BASE}/api/merchants/search?q=${encodeURIComponent(query)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function getRecommendations(merchantId: string) {
  const res = await fetch(`${BASE}/api/recommend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ merchant_id: merchantId }),
  });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  return res.json();
}

export async function getNearbyMerchants(lat: number, lng: number) {
  const res = await fetch(
    `${BASE}/api/merchants/nearby?lat=${lat}&lng=${lng}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`Nearby failed: ${res.status}`);
  return res.json();
}
```

> **Why proxy through Next.js and not call Supabase directly?**  
> The recommendation engine, scoring logic, and merchant enrichment all live in `lib/engine/`. Keeping them server-side means one source of truth and no duplicate logic in the mobile app.

---

## Phase 5 — Screen Mapping (Web → Mobile)

| Web route | Mobile screen | Key differences |
|-----------|---------------|-----------------|
| `/` | `(tabs)/index.tsx` | Replace `<input>` with `TextInput`, remove CSS classes, use `FlatList` for results |
| `/wallet` | `(tabs)/wallet.tsx` | Replace HTML with `View`/`Pressable`, modal becomes `Modal` or bottom sheet |
| `/recommend/[merchantId]` | `recommend/[merchantId].tsx` | Same data, different layout components |
| `/login` | `(auth)/login.tsx` | Same Supabase call, different form components |
| `/signup` | `(auth)/signup.tsx` | Same Supabase call |

### Tailwind → StyleSheet
The web app uses Tailwind CSS. In React Native you use `StyleSheet.create()` or [NativeWind](https://www.nativewind.dev/) (Tailwind syntax for RN). NativeWind is the fastest migration path since the design tokens and class names are already established.

```bash
npx expo install nativewind tailwindcss
```

### Navigation
Replace `next/navigation` → `expo-router`. The file conventions are nearly identical (both use App Router / file-based routing).

| Next.js | Expo Router |
|---------|-------------|
| `useRouter()` from `next/navigation` | `useRouter()` from `expo-router` |
| `<Link href="/wallet">` | `<Link href="/(tabs)/wallet">` |
| `router.push('/recommend/123')` | `router.push('/recommend/123')` |

---

## Phase 6 — Location (Nearby Merchants)

The web app has a location detection feature. On iOS, use `expo-location` instead of the browser Geolocation API.

```ts
import * as Location from 'expo-location';

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}
```

The `expo-location` plugin is already added in the `app.json` above. The permission string shows up in the iOS Settings app.

---

## Phase 7 — Running on Your iPhone

### Option A: Expo Go (recommended for personal use)

1. Install **Expo Go** from the App Store on your iPhone.
2. On your Mac, start the dev server:
   ```bash
   cd mobile
   npx expo start
   ```
3. Scan the QR code with your iPhone camera. The app opens instantly in Expo Go.
4. Hot reload works over your local Wi-Fi. No build, no certificate, no Apple account needed.

**Limitation:** Expo Go sandboxes your app. Custom native modules not included in Expo Go's runtime won't work. For this project (no custom native code), it works perfectly.

### Option B: Sideload via Xcode (standalone build, free account)

If you want to run the app without the Expo Go shell (i.e., a standalone binary on your home screen):

1. Build a development client:
   ```bash
   npx expo run:ios
   ```
   This opens Xcode with a generated `.xcworkspace`.

2. In Xcode:
   - Select your iPhone as the target device.
   - Under **Signing & Capabilities**, select your free Apple ID as the team.
   - Xcode will issue a free provisioning profile valid for **7 days**.
   - Hit Run (⌘R).

3. Every 7 days you need to re-sign and re-install (just run the same command again in Xcode).

### Option C: TestFlight (requires $99/yr Apple Developer Program)

If you want to upgrade later:
1. Enroll at [developer.apple.com/enroll](https://developer.apple.com/enroll).
2. Build with EAS Build: `npx eas build --platform ios`
3. Submit to TestFlight: `npx eas submit --platform ios`
4. Install from TestFlight — no 7-day expiry, shares with up to 10,000 testers.

---

## Phase 8 — EAS Build (Optional, for a clean IPA)

If Xcode sideloading feels painful, Expo Application Services (EAS) can build the IPA in the cloud.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile development
```

EAS Build is free for personal projects (limited build minutes). The resulting `.ipa` can be installed via Xcode's **Devices & Simulators** panel without going through the App Store.

---

## Implementation Checklist

### Week 1 — Foundation
- [ ] Deploy Next.js to Vercel (if not already)
- [ ] Configure CORS headers in `next.config.ts`
- [ ] Add mobile redirect URLs to Supabase Auth config
- [ ] Scaffold Expo project with `create-expo-app`
- [ ] Set up Supabase client with AsyncStorage
- [ ] Implement root auth guard in `_layout.tsx`
- [ ] Implement Login and Signup screens
- [ ] Verify end-to-end auth works in Expo Go

### Week 2 — Core Screens
- [ ] Build API client (`lib/api.ts`)
- [ ] Home / search screen with `TextInput` + `FlatList`
- [ ] Recommendation screen
- [ ] Wallet screen (add/remove cards)
- [ ] Bottom tab navigator

### Week 3 — Polish
- [ ] Location permission + nearby merchants
- [ ] NativeWind styling to match web app's design tokens
- [ ] Loading skeletons / error states
- [ ] Test all flows on physical iPhone via Expo Go

---

## Key Gotchas

| Issue | Solution |
|-------|----------|
| Supabase session not persisting between app restarts | Use `AsyncStorage` adapter in Supabase client (Phase 3) |
| CORS errors when calling Vercel API from mobile | Add `Access-Control-Allow-Origin` headers in `next.config.ts` (Phase 1.3) |
| `next/navigation` not available in RN | Use `expo-router`'s `useRouter` |
| Tailwind classes don't render | Use NativeWind or `StyleSheet.create()` |
| Location on iOS requires explicit permission string | Set in `app.json` plugins (Phase 2.4) |
| Bearer token not forwarded to API | Always pass `Authorization: Bearer <token>` via `authHeaders()` in `lib/api.ts` |
| Expo Go 7-day cert expiry | There's no expiry with Expo Go — only with Xcode sideloaded builds |

---

## Cost Summary

| Item | Cost |
|------|------|
| Vercel (hobby tier) | Free |
| Supabase (free tier) | Free |
| Expo Go personal use | Free |
| EAS Build (personal) | Free (limited minutes) |
| Apple Developer Program (TestFlight/App Store) | $99/yr — not required for personal use |

**Total to get the app on your iPhone: $0.**
