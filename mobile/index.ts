import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';
import './src/i18n/polyfills';
import App from './App';

/**
 * Arabic / RTL demo: force RTL layout app-wide.
 * Set to false for LTR; you may need to reload the app (see mobile/README.md).
 */
export const FORCE_RTL_DEMO = true;

I18nManager.allowRTL(true);
if (FORCE_RTL_DEMO) {
  I18nManager.forceRTL(true);
}

registerRootComponent(App);
