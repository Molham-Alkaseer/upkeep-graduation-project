import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { fonts, gradientLogin, gradientPrimary, shadows } from './theme';

type Variant = 'brand' | 'login';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

/** Matches web `.btn-primary` (brand) and `.btn-login` (login). */
export function GradientActionButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'brand',
  style,
}: Props) {
  const colors = variant === 'login' ? gradientLogin : gradientPrimary;
  const shadow = variant === 'login' ? shadows.loginBtn : shadows.primaryBtn;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.pressable,
        shadow,
        style,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  label: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.92 },
});
