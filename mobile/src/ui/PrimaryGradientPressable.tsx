import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, gradientPrimary, shadows } from './theme';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Web-aligned primary CTA (blue → cyan gradient, shadow). */
export function PrimaryGradientPressable({ onPress, disabled, style, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrap,
        shadows.primaryBtn,
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[...gradientPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export const primaryGradientLabel = StyleSheet.create({
  text: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.92 },
});
