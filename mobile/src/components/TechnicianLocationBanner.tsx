import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fonts } from '../ui/theme';

type Props = {
  onRetry: () => void;
};

export function TechnicianLocationBanner({ onRetry }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t('technicianNearby.locationDeniedBanner')}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => void Linking.openSettings()}
          accessibilityRole="link"
          accessibilityLabel={t('technicianNearby.enableLocationLink')}
        >
          <Text style={styles.link}>{t('technicianNearby.enableLocationLink')}</Text>
        </Pressable>
        <Text style={styles.sep}> · </Text>
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('errors.retry')}>
          <Text style={styles.link}>{t('errors.retry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primaryBlue,
  },
  sep: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
});
