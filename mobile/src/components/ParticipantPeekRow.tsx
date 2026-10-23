import { Pressable, StyleSheet, Text } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { colors, fonts } from '../ui/theme';

type Props = {
  photoUri: string | null;
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
};

/** Avatar + name row for list cards; tap opens public profile (separate from card → detail). */
export function ParticipantPeekRow({
  photoUri,
  title,
  onPress,
  accessibilityLabel,
  size = 36,
}: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <UserAvatar uri={photoUri} size={size} />
      <Text style={styles.name} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryBlue,
    textAlign: 'start' as any,
  },
});
