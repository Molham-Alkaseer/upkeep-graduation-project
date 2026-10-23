import i18nConstants from '../../../../locales/i18n.constants.json';
import { resolveLanguageConflict } from '../accountLanguageSync';

describe('account language conflict resolution', () => {
  it('prefers explicit local language over server', () => {
    const out = resolveLanguageConflict({ localExplicit: 'ar', serverPreferred: 'en' });
    expect(out.winner).toBe('ar');
    expect(out.reason).toBe('local-explicit');
    expect(out.shouldPushWinnerToServer).toBe(true);
  });

  it('uses server language when local explicit is absent', () => {
    const out = resolveLanguageConflict({ localExplicit: null, serverPreferred: 'ar-SA' });
    expect(out.winner).toBe('ar');
    expect(out.reason).toBe('server');
    expect(out.shouldPushWinnerToServer).toBe(false);
  });

  it('falls back to default when neither local nor server exists', () => {
    const out = resolveLanguageConflict({ localExplicit: null, serverPreferred: null });
    expect(out.winner).toBe(i18nConstants.DEFAULT_LANGUAGE);
    expect(out.reason).toBe('default');
    expect(out.shouldPushWinnerToServer).toBe(false);
  });
});

