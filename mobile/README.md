# UpKeep Mobile (Expo)

Expo SDK **54** (matches **Expo Go** on the Play Store / App Store), **TypeScript**, **React Navigation** native stack. Consumes the Flask API under `/api/v1`.

## Prerequisites

- Node.js 20+ (see [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) for supported versions)
- npm or yarn
- Flask backend running (default port `5000`)

## API URL

The app reads **`EXPO_PUBLIC_API_URL`** at bundle time (Expo embeds `EXPO_PUBLIC_*` from **`mobile/.env`**).

1. Copy **`.env.example`** → **`.env`** in this folder.
2. Set a URL that reaches **Flask on your PC** (Flask listens on **`0.0.0.0:5000`** by default in this project):

   ```env
   EXPO_PUBLIC_API_URL=http://MY_LAN_IP:5000
   ```

   Replace **`MY_LAN_IP`** with your computer’s **LAN IPv4** (e.g. `192.168.1.42`) when using a **physical phone** on the same Wi‑Fi.

   | Client | Typical `EXPO_PUBLIC_API_URL` |
   |--------|------------------------------|
   | Physical Android / iPhone | `http://<PC-LAN-IP>:5000` |
   | Android emulator | `http://10.0.2.2:5000` |
   | iOS Simulator (Mac, server on Mac) | `http://127.0.0.1:5000` often works |

   For a **real device on the same Wi‑Fi** as the PC, do **not** use `127.0.0.1` in `.env` — that would point at the phone, not your computer.

   **Exception — Android + USB:** if you run `.\scripts\adb-reverse-metro.ps1` (forwards **5000** and **8081**), then from the phone `127.0.0.1` goes to your PC through USB. Use:

   ```env
   EXPO_PUBLIC_API_URL=http://127.0.0.1:5000
   ```

   with `npm run start:usb` (or `npx expo start --localhost`). Switch `.env` back to your PC LAN IP when you stop using USB forwarding.

3. Restart Expo after any `.env` change: `npx expo start`.

If you leave the placeholder (`MY_LAN_IP` / `LOCAL_IP`) in the URL, the app will show an Arabic error until you set a real address.

`app.config.ts` → `extra.expoPublicApiUrlDefault` mirrors the documented placeholder only; runtime uses **`src/api.ts`** and **`process.env.EXPO_PUBLIC_API_URL`**.

## RTL (Arabic demo)

In **`index.ts`**, `FORCE_RTL_DEMO` is **`true`**: `I18nManager.allowRTL(true)` and `I18nManager.forceRTL(true)` so layouts mirror for Arabic.

- To use **LTR**, set `FORCE_RTL_DEMO` to **`false`**, save, and **reload** the app (full reload may be required on some devices).
- UI strings on Login/Home are Arabic-oriented with `textAlign: 'right'` where relevant.

## Scripts

```bash
cd mobile
npm install
npx expo start
```

Then open in **Expo Go** (must support SDK **54** — update the app from the store) or run on an emulator (`a` / `i` in the CLI).

### “Check your connection” / can’t load project

- PC and phone on the **same Wi‑Fi** (not guest Wi‑Fi if it uses **AP / client isolation**).
- Run `npx expo start` (LAN). In Expo Go use **Enter URL manually** with the `exp://YOUR_PC_IP:8081` line from the terminal.
- **Windows:** allow **Node.js** on **Private** networks; optionally allow inbound **TCP 8081**.
- **Android + USB:** run `.\scripts\adb-reverse-metro.ps1` from the `mobile` folder (forwards **8081** + **5000**). Start Expo with `npm run start:usb`. If the app loads but login shows **«تعذر الاتصال بالخادم»**, set `EXPO_PUBLIC_API_URL=http://127.0.0.1:5000` in `.env`, restart Expo, and ensure Flask is listening on **`0.0.0.0:5000`** (not only `127.0.0.1`) on the PC.

## Flow

1. **Login** — `POST /api/v1/auth/login` with email/password; stores `access_token` in **expo-secure-store**.
2. **Home** — `GET /api/v1/me` with `Authorization: Bearer …`; shows **email** and **role**. Pull to refresh; **تسجيل الخروج** clears the token.

Flask enables **CORS for `/api/*`** by default (`FLASK_ENABLE_CORS`, see root `.env.example`). Native Expo calls do not need CORS; it matters for **Expo web** and browser-based tooling.

## Git

`node_modules/` is listed in **`.gitignore`**. Do not commit `.env` if it contains machine-specific IPs.
