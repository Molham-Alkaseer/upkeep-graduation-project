import i18nConstants from '../../../locales/i18n.constants.json';
import { apiSavePreferredLanguage } from '../api';
import { getAccessToken } from '../authStorage';
import {
  getCurrentLanguage,
  normalizeLanguage,
  readPersistedLanguageOrNull,
  setLanguage,
  type AppLanguage,
} from './localeManager';

export type LanguageConflictResolution = {
  winner: AppLanguage;
  reason: 'local-explicit' | 'server' | 'default';
  shouldPushWinnerToServer: boolean;
};

export function resolveLanguageConflict(input: {
  localExplicit: AppLanguage | null;
  serverPreferred: string | null | undefined;
}): LanguageConflictResolution {
  const server = input.serverPreferred ? normalizeLanguage(input.serverPreferred) : null;
  if (input.localExplicit) {
    return {
      winner: input.localExplicit,
      reason: 'local-explicit',
      shouldPushWinnerToServer: server == null || server !== input.localExplicit,
    };
  }
  if (server) {
    return {
      winner: server,
      reason: 'server',
      shouldPushWinnerToServer: false,
    };
  }
  return {
    winner: i18nConstants.DEFAULT_LANGUAGE as AppLanguage,
    reason: 'default',
    shouldPushWinnerToServer: false,
  };
}

export async function syncLanguageWithAccountPreference(
  serverPreferred: string | null | undefined,
): Promise<LanguageConflictResolution> {
  const localExplicit = await readPersistedLanguageOrNull();
  const resolution = resolveLanguageConflict({ localExplicit, serverPreferred });

  if (resolution.winner !== getCurrentLanguage()) {
    await setLanguage(resolution.winner);
  }

  if (resolution.shouldPushWinnerToServer) {
    const token = await getAccessToken();
    if (token) {
      void apiSavePreferredLanguage(resolution.winner).catch(() => {
        // Optional sync: never block UX on account language persistence.
      });
    }
  }

  return resolution;
}

export function syncLanguagePreferenceToServerIfLoggedIn(lang: AppLanguage): void {
  void getAccessToken().then((token) => {
    if (!token) return;
    void apiSavePreferredLanguage(lang).catch(() => {
      // Offline-safe best-effort sync.
    });
  });
}

