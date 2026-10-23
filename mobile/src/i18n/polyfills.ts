/**
 * i18next plural rules require Intl.PluralRules.
 * Some Android/Hermes environments may not provide it by default.
 */
if (typeof Intl === 'undefined' || typeof Intl.PluralRules === 'undefined') {
  require('intl-pluralrules');
}

