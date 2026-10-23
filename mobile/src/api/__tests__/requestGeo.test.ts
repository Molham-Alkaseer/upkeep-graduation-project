import {
  buildRequestDetailQuery,
  buildRequestsListQuery,
  formatDistanceKm,
  parseDistanceKm,
} from '../requestGeo';

describe('requestGeo', () => {
  describe('buildRequestsListQuery', () => {
    it('returns empty string when no filters', () => {
      expect(buildRequestsListQuery()).toBe('');
    });

    it('encodes status only', () => {
      expect(buildRequestsListQuery('pending')).toBe('?status=pending');
    });

    it('encodes geo params with radius and sort', () => {
      const qs = buildRequestsListQuery(undefined, {
        lat: 24.7136,
        lng: 46.6753,
        radius_km: 50,
        sort: 'distance',
      });
      expect(qs).toContain('lat=24.7136');
      expect(qs).toContain('lng=46.6753');
      expect(qs).toContain('radius_km=50');
      expect(qs).toContain('sort=distance');
    });

    it('combines status and geo', () => {
      const qs = buildRequestsListQuery('pending', { lat: 1, lng: 2 });
      expect(qs).toMatch(/status=pending/);
      expect(qs).toMatch(/lat=1/);
      expect(qs).toMatch(/lng=2/);
    });
  });

  describe('buildRequestDetailQuery', () => {
    it('returns empty string when geo omitted', () => {
      expect(buildRequestDetailQuery()).toBe('');
    });

    it('encodes lat and lng only', () => {
      const qs = buildRequestDetailQuery({ lat: 24.7136, lng: 46.6753 });
      expect(qs).toBe('?lat=24.7136&lng=46.6753');
    });
  });

  describe('parseDistanceKm', () => {
    it('returns undefined for nullish', () => {
      expect(parseDistanceKm(null)).toBeUndefined();
      expect(parseDistanceKm(undefined)).toBeUndefined();
    });

    it('rounds to one decimal', () => {
      expect(parseDistanceKm(12.456)).toBe(12.5);
      expect(parseDistanceKm('3.04')).toBe(3);
    });

    it('rejects invalid values', () => {
      expect(parseDistanceKm('n/a')).toBeUndefined();
    });
  });

  describe('formatDistanceKm', () => {
    it('formats with one decimal and unit', () => {
      expect(formatDistanceKm(12.44)).toBe('12.4 km');
      expect(formatDistanceKm(3, 'كم')).toBe('3.0 كم');
    });
  });
});
