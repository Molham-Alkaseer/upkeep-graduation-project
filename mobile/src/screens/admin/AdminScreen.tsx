import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assertApiBaseConfigured, getApiBase } from '../../api';
import type { AdminStackParamList } from '../../navigation/types';
import { useAppDialog } from '../../ui/AppDialog';
import { commonStyles } from '../../ui/commonStyles';
import { chevronForwardReading } from '../../i18n/directionalIcons';
import { useIsRTL } from '../../i18n/useIsRTL';
import { colors, fonts, radii, shadows } from '../../ui/theme';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminHome'>;

type AdminQuickLink = {
  path: string;
  title: string;
  subtitle: string;
  optional?: boolean;
};

const ADMIN_QUICK_LINKS: AdminQuickLink[] = [
  { path: '/admin', title: 'لوحة الإدارة', subtitle: 'الإحصائيات ولوحة التحكم' },
  { path: '/admin/invoices', title: 'فواتير الإدارة', subtitle: 'عرض الفواتير والتصدير' },
  { path: '/admin/users', title: 'إدارة المستخدمين', subtitle: 'المستخدمون والأدوار' },
  { path: '/admin/requests', title: 'إدارة الطلبات', subtitle: 'متابعة جميع الطلبات' },
  { path: '/admin/settings', title: 'إعدادات النظام', subtitle: 'نسخ احتياطي واستعادة', optional: true },
];

function buildAdminUrl(path: string): string {
  assertApiBaseConfigured();
  const base = getApiBase();
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error('عنوان الخادم غير صالح. راجع EXPO_PUBLIC_API_URL في ملف .env.');
  }
  return `${parsed.origin}${path}`;
}

export function AdminScreen({ navigation }: Props) {
  const rtl = useIsRTL();
  const { showDialog } = useAppDialog();

  async function openAdminPath(path: string): Promise<void> {
    try {
      const url = buildAdminUrl(path);
      await Linking.openURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر فتح الرابط.';
      showDialog({
        title: 'تعذر فتح الرابط',
        message: `${msg}\n\nتأكد أن عنوان الخادم صحيح وأن الجهاز على نفس الشبكة.`,
      });
    }
  }

  return (
    <ScrollView style={commonStyles.screenBg} contentContainerStyle={styles.content}>
      <Text style={commonStyles.title}>لوحة المسؤول</Text>
      <Text style={styles.intro}>
        هذا القسم يجمع أدوات المسؤول في مكان واضح. يمكنك فتح صفحات الويب الإدارية مباشرة، أو استخدام شاشة
        الفواتير الأصلية داخل التطبيق.
      </Text>

      <Pressable style={styles.nativeCard} onPress={() => navigation.navigate('AdminInvoices')}>
        <View>
          <Text style={styles.nativeTitle}>الفواتير (داخل التطبيق)</Text>
          <Text style={styles.nativeSubtitle}>قائمة + فلاتر + إجماليات + فتح تصدير CSV</Text>
        </View>
        <Ionicons name={chevronForwardReading(rtl)} size={20} color={colors.primaryBlue} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>صفحات الإدارة (ويب)</Text>
      </View>

      {ADMIN_QUICK_LINKS.map((item) => (
        <Pressable key={item.path} style={styles.linkCard} onPress={() => void openAdminPath(item.path)}>
          <View style={styles.linkTextWrap}>
            <Text style={styles.linkTitle}>
              {item.title}
              {item.optional ? ' (اختياري)' : ''}
            </Text>
            <Text style={styles.linkSubtitle}>{item.subtitle}</Text>
            <Text style={styles.linkPath}>{item.path}</Text>
          </View>
          <Ionicons name="open-outline" size={20} color={colors.primaryBlue} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  intro: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    lineHeight: 22,
    marginBottom: 14,
  },
  nativeCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  nativeTitle: {
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
    fontSize: 16,
    textAlign: 'start' as any,
  },
  nativeSubtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'start' as any,
    fontSize: 15,
  },
  linkCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  linkTextWrap: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  linkTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  linkSubtitle: {
    marginTop: 3,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'start' as any,
  },
  linkPath: {
    marginTop: 4,
    fontFamily: fonts.regular,
    color: colors.primaryBlue,
    fontSize: 12,
    textAlign: 'start' as any,
  },
});
