/**
 * Web i18n bootstrap: localStorage persistence, document lang/dir, i18next init.
 * Depends on window.__UPKEEP_I18N__ (injected from locales/i18n.constants.json) and global i18next.
 */
(function () {
  'use strict';

  var cfg = window.__UPKEEP_I18N__ || {};
  var SK = cfg.STORAGE_KEY || 'upkeep.locale';
  var DEF = cfg.DEFAULT_LANGUAGE || 'en';
  var FALL = cfg.FALLBACK_LANGUAGE || 'en';
  var NS = cfg.DEFAULT_NAMESPACE || 'common';

  function normLang(raw) {
    if (raw === 'en' || raw === 'ar') return raw;
    return DEF;
  }

  function getDirection(lang) {
    return normLang(lang) === 'ar' ? 'rtl' : 'ltr';
  }

  function readStored() {
    try {
      return normLang(localStorage.getItem(SK));
    } catch (e) {
      return DEF;
    }
  }

  function applyDocumentLanguage(lang) {
    var l = normLang(lang);
    document.documentElement.setAttribute('lang', l);
    document.documentElement.setAttribute('dir', getDirection(l));
    var link = document.getElementById('bootstrap-theme-css');
    if (link) {
      var rtlHref = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css';
      var ltrHref = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
      link.setAttribute('href', getDirection(l) === 'rtl' ? rtlHref : ltrHref);
    }
    return l;
  }

  function getCurrentLanguage() {
    if (typeof i18next !== 'undefined' && i18next.isInitialized) {
      return normLang(i18next.language);
    }
    return readStored();
  }

  function setLanguage(lang) {
    var next = normLang(lang);
    try {
      localStorage.setItem(SK, next);
    } catch (e) {}
    try {
      document.cookie =
        SK + '=' + encodeURIComponent(next) + ';path=/;max-age=31536000;SameSite=Lax';
    } catch (e) {}
    applyDocumentLanguage(next);
    if (typeof i18next !== 'undefined' && i18next.isInitialized) {
      return i18next.changeLanguage(next);
    }
    return Promise.resolve();
  }

  window.UpkeepLocale = {
    getDirection: getDirection,
    getCurrentLanguage: getCurrentLanguage,
    setLanguage: setLanguage,
    normalizeLanguage: normLang,
  };

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  if (typeof i18next === 'undefined') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[i18n] i18next global missing');
    }
    return;
  }

  Promise.all([fetchJson('/locales/en/common.json'), fetchJson('/locales/ar/common.json')])
    .then(function (bundles) {
      var lng = readStored();
      applyDocumentLanguage(lng);
      return i18next.init({
        lng: lng,
        fallbackLng: FALL,
        defaultNS: NS,
        ns: [NS],
        resources: {
          en: { common: bundles[0] },
          ar: { common: bundles[1] },
        },
        returnEmptyString: false,
        saveMissing: false,
        parseMissingKeyHandler: function (key) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[i18n] missing key: ' + key);
          }
          return key;
        },
      });
    })
    .catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[i18n] init failed', err);
      }
    });
})();
