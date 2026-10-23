import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './theme';

type Props = {
  title?: string;
  hint?: string;
};

/** Shared empty state for request lists (customer / technician). */
export function RequestListEmpty({ title, hint }: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('emptyStates.requestListTitle');
  const resolvedHint = hint ?? t('emptyStates.requestListHint');
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Ionicons name="document-text-outline" size={40} color={colors.borderSoft} />
      <Text style={styles.title}>{resolvedTitle}</Text>
      {resolvedHint ? <Text style={styles.hint}>{resolvedHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  title: {
    marginTop: 12,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
