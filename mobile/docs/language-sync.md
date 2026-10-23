# Account-Level Language Sync

This app supports optional account-level language persistence while staying offline-safe.

## Goals

- Keep startup fast and local-first.
- Respect explicit device-local language choices.
- Sync preference to account when authenticated (best effort).
- Never block the UI on language sync network calls.

## Conflict Resolution Rules

When both local and server language preferences exist:

1. **Explicit local preference wins** (`upkeep.locale` exists in device storage).
2. Else, **server preference wins** (from `GET /api/v1/me -> user.preferred_language`).
3. Else, **default language wins** (`i18n.constants.DEFAULT_LANGUAGE`).

## Sync Behavior

- On authenticated user refresh (`UserProvider.refresh`):
  - Resolve winner using rules above.
  - Apply winner locally if needed.
  - If local explicit preference won and differs from server, push winner to server in background.

- On manual language change (`LanguageSettingsScreen`):
  - Apply local change immediately.
  - If logged in, push selected language to server in background.

## Offline / Reliability Notes

- Account sync is **best effort**.
- Any sync API failure is swallowed intentionally (non-crashing).
- Startup never waits on network for language sync.
- Language application is always available from local persisted storage.

