import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './theme';

/**
 * Approximates web `body` background: soft blue/cyan radial hints over `--bg-page`.
 */
export function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(37, 99, 235, 0.14)', 'transparent']}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.85, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(6, 182, 212, 0.11)', 'transparent']}
        start={{ x: 0.92, y: 0 }}
        end={{ x: 0.2, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tint}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  tint: {
    flex: 1,
  },
});
