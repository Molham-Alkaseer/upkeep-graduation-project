import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../ui/theme';

type Props = {
  uri: string | null;
  /** Kept for call-site compatibility; fallback is always the gray placeholder icon. */
  name?: string;
  size?: number;
};

/**
 * Circular avatar: remote image with fallback gray person-circle icon (failed loads / no photo).
 */
export function UserAvatar({ uri, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(uri) && !failed;
  const r = size / 2;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: r,
        },
      ]}
    >
      {showImg ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size, borderRadius: r }}
          onError={() => setFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: r,
            },
          ]}
        >
          <Ionicons
            name="person-circle"
            size={size}
            color={colors.avatarFallbackIcon}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.avatarFallbackBg,
  },
  fallback: {
    backgroundColor: colors.avatarFallbackBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
