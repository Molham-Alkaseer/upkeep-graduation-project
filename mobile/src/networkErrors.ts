import i18n from 'i18next';

/**
 * React Native fetch surfaces runtime-specific transport failures.
 * Map them to concise, locale-aware user copy.
 */

const RAW_NETWORK_MARKERS = [
  'network request failed',
  'failed to fetch',
  'networkerror',
  'aborted',
  'load failed',
  'connection refused',
] as const;

function isRawNetworkFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const low = msg.toLowerCase();
  return RAW_NETWORK_MARKERS.some((m) => low.includes(m));
}

export function wrapNetworkError(e: unknown): Error {
  if (isRawNetworkFailure(e)) {
    return new Error(i18n.t('network.unreachable'));
  }
  const msg = e instanceof Error ? e.message : String(e);
  return e instanceof Error ? e : new Error(msg);
}
