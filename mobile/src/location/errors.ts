/** Typed location failures for UI handling (permission, services, fix unavailable). */
export type LocationErrorCode = 'permission_denied' | 'services_disabled' | 'unavailable';

export class LocationError extends Error {
  readonly code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

export function isLocationError(e: unknown): e is LocationError {
  return e instanceof LocationError;
}
