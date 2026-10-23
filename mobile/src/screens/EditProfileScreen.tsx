import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  apiPatchMe,
  apiSpecializations,
  apiUploadProfileImage,
  meProfilePhotoUri,
  type PatchMeBody,
  type SpecializationItem,
} from '../api';
import { useUser } from '../context/UserContext';
import { UserAvatar } from '../components/UserAvatar';
import type { HomeStackParamList } from '../navigation/types';
import { wrapNetworkError } from '../networkErrors';
import { useAppDialog } from '../ui/AppDialog';
import { authShellStyles } from '../ui/authShell';
import { dialogCopy } from '../ui/dialogCopy';
import { GradientActionButton } from '../ui/GradientActionButton';
import { KeyboardSafeScrollView } from '../ui/KeyboardSafeScrollView';
import { colors, fonts, radii } from '../ui/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditProfile'>;

function passwordMeetsRules(pw: string): boolean {
  if (pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[a-z]/.test(pw)) return false;
  if (!/\d/.test(pw)) return false;
  return true;
}

export function EditProfileScreen({ navigation }: Props) {
  const { showDialog } = useAppDialog();
  const { user, loading, refresh } = useUser();

  const [fullNameAr, setFullNameAr] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [bio, setBio] = useState('');
  const [specs, setSpecs] = useState<SpecializationItem[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);

  const isTechnician = user?.role === 'technician';

  const loadSpecs = useCallback(async () => {
    if (!isTechnician) return;
    setSpecsLoading(true);
    try {
      const { specializations } = await apiSpecializations();
      setSpecs(specializations);
    } catch {
      setSpecs([]);
    } finally {
      setSpecsLoading(false);
    }
  }, [isTechnician]);

  useEffect(() => {
    void loadSpecs();
  }, [loadSpecs]);

  useEffect(() => {
    if (!user) return;
    setFullNameAr(user.full_name_ar?.trim() ?? '');
    setFullNameEn(user.full_name_en?.trim() ?? '');
    setPhone(user.phone?.trim() ?? '');
    setCity(user.city?.trim() ?? '');
    setDistrict(user.district?.trim() ?? '');
    setBio(user.bio?.trim() ?? '');
    setLocalAvatarUri(null);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    if (user.specialization_id != null) {
      setSelectedSpecId(user.specialization_id);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'technician' || specs.length === 0) return;
    setSelectedSpecId((prev) => {
      if (prev != null && specs.some((s) => s.spec_id === prev)) return prev;
      if (
        user.specialization_id != null &&
        specs.some((s) => s.spec_id === user.specialization_id)
      ) {
        return user.specialization_id;
      }
      return specs[0].spec_id;
    });
  }, [user, specs]);

  const avatarDisplayUri = useMemo(() => {
    if (localAvatarUri) return localAvatarUri;
    if (user) return meProfilePhotoUri(user);
    return null;
  }, [localAvatarUri, user]);

  async function pickAvatar() {
    if (Platform.OS === 'web') {
      showDialog({
        title: dialogCopy.alertTitle,
        message: 'تغيير الصورة من التطبيق على الهاتف فقط حالياً.',
      });
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showDialog({
        title: dialogCopy.alertTitle,
        message: 'يُرجى السماح بالوصول إلى معرض الصور لتحديث صورة الملف الشخصي.',
      });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    setLocalAvatarUri(res.assets[0].uri);
  }

  async function onSave() {
    if (!user) return;
    if (!fullNameAr.trim() || !fullNameEn.trim()) {
      showDialog({
        title: dialogCopy.alertTitle,
        message: 'يرجى إدخال الاسم الكامل بالعربية والإنجليزية',
      });
      return;
    }
    if (!phone.trim()) {
      showDialog({ title: dialogCopy.alertTitle, message: 'يرجى إدخال رقم الجوال' });
      return;
    }
    if (isTechnician && selectedSpecId == null) {
      showDialog({ title: dialogCopy.alertTitle, message: 'يرجى اختيار التخصص' });
      return;
    }

    const c = currentPw.trim();
    const n = newPw.trim();
    const v = confirmPw.trim();
    const anyPw = c.length > 0 || n.length > 0 || v.length > 0;
    if (anyPw) {
      if (!c || !n || !v) {
        showDialog({
          title: dialogCopy.alertTitle,
          message: 'لتغيير كلمة المرور أكمل الحقول الثلاثة أو اتركها كلها فارغة.',
        });
        return;
      }
      if (!passwordMeetsRules(n)) {
        showDialog({
          title: dialogCopy.alertTitle,
          message:
            'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل وتشمل حرفاً كبيراً وحرفاً صغيراً ورقماً.',
        });
        return;
      }
      if (n !== v) {
        showDialog({ title: dialogCopy.alertTitle, message: 'تأكيد كلمة المرور غير متطابق' });
        return;
      }
    }

    const body: PatchMeBody = {
      full_name_ar: fullNameAr.trim(),
      full_name_en: fullNameEn.trim(),
      phone: phone.trim(),
      city: city.trim(),
      district: district.trim(),
      bio: bio.trim(),
    };
    if (isTechnician && selectedSpecId != null) {
      body.specialization_id = selectedSpecId;
    }
    if (anyPw && c && n && v) {
      body.current_password = c;
      body.new_password = n;
      body.confirm_password = v;
    }

    setSaving(true);
    try {
      await apiPatchMe(body);
      if (localAvatarUri) {
        const form = new FormData();
        const extMatch = /\.(\w+)$/.exec(localAvatarUri);
        const ext = (extMatch?.[1] ?? 'jpg').toLowerCase();
        const mime =
          ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const name = `avatar.${ext === 'jpeg' ? 'jpg' : ext}`;
        form.append('file', { uri: localAvatarUri, name, type: mime } as unknown as Blob);
        await apiUploadProfileImage(form);
      }
      await refresh();
      navigation.goBack();
    } catch (e) {
      showDialog({ title: dialogCopy.errorTitle, message: wrapNetworkError(e).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !user) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.boot}>
        <Text style={styles.muted}>لا توجد بيانات مستخدم</Text>
      </View>
    );
  }

  return (
    <KeyboardSafeScrollView style={authShellStyles.scroll} contentContainerStyle={authShellStyles.container}>
      <View style={authShellStyles.card}>
        <Text style={styles.screenTitle}>تعديل الملف الشخصي</Text>
        <Text style={styles.hint}>عدّل معلوماتك ثم اضغط «حفظ». البريد الإلكتروني ثابت ولا يُغيّر من هنا.</Text>

        <View style={styles.avatarBlock}>
          <Pressable
            style={styles.avatarPressable}
            onPress={() => void pickAvatar()}
            accessibilityRole="button"
            accessibilityLabel="تغيير الصورة"
          >
            <UserAvatar uri={avatarDisplayUri} size={112} />
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={18} color={colors.bgSurface} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>اضغط لتغيير صورة الملف الشخصي</Text>
        </View>

        {isTechnician ? (
          <View style={authShellStyles.fieldBlock}>
            <Text style={authShellStyles.fieldLabel}>
              <Ionicons name="construct-outline" size={16} color={colors.primaryBlue} /> التخصص
            </Text>
            {specsLoading ? (
              <ActivityIndicator color={colors.primaryBlue} style={{ marginVertical: 12 }} />
            ) : specs.length === 0 ? (
              <Text style={styles.muted}>تعذر تحميل التخصصات. أغلق الشاشة وأعد المحاولة.</Text>
            ) : (
              <View style={styles.specList}>
                {specs.map((s) => (
                  <Pressable
                    key={s.spec_id}
                    style={[styles.specRow, selectedSpecId === s.spec_id && styles.specRowOn]}
                    onPress={() => setSelectedSpecId(s.spec_id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedSpecId === s.spec_id }}
                  >
                    <Text style={styles.specNameAr}>{s.name_ar}</Text>
                    <Text style={styles.specNameEn}>{s.name_en}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="person-outline" size={16} color={colors.primaryBlue} /> الاسم بالعربية
          </Text>
          <TextInput
            style={authShellStyles.input}
            value={fullNameAr}
            onChangeText={setFullNameAr}
            placeholder="الاسم بالعربية"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="person-outline" size={16} color={colors.primaryBlue} /> الاسم بالإنجليزية
          </Text>
          <TextInput
            style={authShellStyles.input}
            value={fullNameEn}
            onChangeText={setFullNameEn}
            placeholder="Full name (English)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="mail-outline" size={16} color={colors.primaryBlue} /> البريد الإلكتروني
          </Text>
          <TextInput
            style={[authShellStyles.input, styles.readOnlyInput]}
            value={user.email}
            editable={false}
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="call-outline" size={16} color={colors.primaryBlue} /> رقم الجوال
          </Text>
          <TextInput
            style={authShellStyles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="09xxxxxxxx"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="location-outline" size={16} color={colors.primaryBlue} /> المدينة
          </Text>
          <TextInput
            style={authShellStyles.input}
            value={city}
            onChangeText={setCity}
            placeholder="اختياري"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="navigate-outline" size={16} color={colors.primaryBlue} /> المنطقة / الحي
          </Text>
          <TextInput
            style={authShellStyles.input}
            value={district}
            onChangeText={setDistrict}
            placeholder="اختياري"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="document-text-outline" size={16} color={colors.primaryBlue} /> نبذة عنك
          </Text>
          <TextInput
            style={[authShellStyles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="اكتب نبذة قصيرة (اختياري)"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            textAlign="right"
            maxLength={500}
          />
          <Text style={styles.charCount}>{bio.length} / 500</Text>
        </View>

        <Text style={styles.sectionTitle}>تغيير كلمة المرور (اختياري)</Text>
        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>كلمة المرور الحالية</Text>
          <TextInput
            style={authShellStyles.input}
            value={currentPw}
            onChangeText={setCurrentPw}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textAlign="right"
          />
        </View>
        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>كلمة المرور الجديدة</Text>
          <TextInput
            style={authShellStyles.input}
            value={newPw}
            onChangeText={setNewPw}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textAlign="right"
          />
        </View>
        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>تأكيد الجديدة</Text>
          <TextInput
            style={authShellStyles.input}
            value={confirmPw}
            onChangeText={setConfirmPw}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textAlign="right"
          />
        </View>

        <GradientActionButton
          label="حفظ التغييرات"
          variant="brand"
          onPress={() => void onSave()}
          loading={saving}
          disabled={saving}
        />
      </View>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'start' as any,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'start' as any,
    marginBottom: 20,
    lineHeight: 22,
  },
  muted: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'start' as any,
  },
  avatarBlock: { alignItems: 'center', marginBottom: 24 },
  avatarPressable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    end: 2,
    backgroundColor: colors.primaryBlue,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.bgSurface,
  },
  avatarHint: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  readOnlyInput: {
    opacity: 0.72,
    backgroundColor: colors.bgTableHead,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'end' as any,
    marginTop: -8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'start' as any,
    marginTop: 12,
    marginBottom: 8,
  },
  specList: { gap: 8 },
  specRow: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: 12,
    backgroundColor: colors.bgSurface,
  },
  specRowOn: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
  },
  specNameAr: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  specNameEn: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'start' as any,
    marginTop: 4,
  },
});
