import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  apiCreateRequest,
  apiSpecializations,
  type CreateRequestAttachment,
  type SpecializationItem,
} from '../../api';
import { ServiceLocationMapPicker, type ServiceMapCoords } from '../../components/ServiceLocationMapPicker';
import { getCurrentCoords, isLocationError } from '../../location';
import type { NewRequestStackParamList } from '../../navigation/types';
import { useAppDialog } from '../../ui/AppDialog';
import { commonStyles } from '../../ui/commonStyles';
import { PrimaryGradientPressable, primaryGradientLabel } from '../../ui/PrimaryGradientPressable';
import { KeyboardSafeScrollView } from '../../ui/KeyboardSafeScrollView';
import { colors, fonts, radii } from '../../ui/theme';

type Props = NativeStackScreenProps<NewRequestStackParamList, 'CustomerCreateRequest'>;

/** Matches `models.ServiceRequest` enum and web `create_request.html` select values. */
type PreferredTimeSlot = 'morning' | 'afternoon' | 'evening';

type LocationCaptureStatus = 'idle' | 'capturing' | 'ok' | 'denied' | 'error';

const TIME_SLOTS: { value: PreferredTimeSlot; label: string }[] = [
  { value: 'morning', label: 'صباحاً (9:00 - 12:00)' },
  { value: 'afternoon', label: 'ظهراً (12:00 - 3:00)' },
  { value: 'evening', label: 'مساءً (3:00 - 6:00)' },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CustomerCreateRequestScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const [specs, setSpecs] = useState<SpecializationItem[]>([]);
  const [specLoading, setSpecLoading] = useState(true);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState<Date | null>(null);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<PreferredTimeSlot | null>(null);
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [iosDatePickerOpen, setIosDatePickerOpen] = useState(false);
  const [iosDraftDate, setIosDraftDate] = useState<Date>(() => startOfToday());
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<CreateRequestAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState<ServiceMapCoords | null>(null);
  const [mapLayoutKey, setMapLayoutKey] = useState(0);
  const [locationStatus, setLocationStatus] = useState<LocationCaptureStatus>('idle');
  const [locationLoading, setLocationLoading] = useState(false);

  const loadSpecs = useCallback(async () => {
    try {
      const { specializations } = await apiSpecializations();
      setSpecs(specializations);
      setSelectedSpecId((prev) => {
        if (specializations.length === 0) return null;
        if (prev != null && specializations.some((s) => s.spec_id === prev)) return prev;
        return specializations[0].spec_id;
      });
    } catch (e) {
      showDialog({
        title: 'خطأ',
        message: e instanceof Error ? e.message : 'تعذر تحميل التخصصات',
      });
    } finally {
      setSpecLoading(false);
      setRefreshing(false);
    }
  }, [showDialog]);

  useEffect(() => {
    setSpecLoading(true);
    void loadSpecs();
  }, [loadSpecs]);

  async function onSubmit() {
    if (selectedSpecId == null) {
      showDialog({ title: 'تنبيه', message: 'اختر نوع الخدمة' });
      return;
    }
    if (description.trim().length < 20) {
      showDialog({ title: 'تنبيه', message: 'الوصف 20 حرفاً على الأقل' });
      return;
    }
    if (!city.trim() || !district.trim() || !address.trim()) {
      showDialog({ title: 'تنبيه', message: 'أدخل المدينة والحي والعنوان' });
      return;
    }
    if (preferredDate == null || preferredTimeSlot == null) {
      showDialog({ title: 'تنبيه', message: 'اختر التاريخ والوقت المفضلين' });
      return;
    }
    if (!coords) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('customerCreateRequest.pinRequired'),
      });
      return;
    }
    setSubmitting(true);
    try {
      const { request } = await apiCreateRequest(
        {
          service_type: selectedSpecId,
          description: description.trim(),
          city: city.trim(),
          district: district.trim(),
          address: address.trim(),
          preferred_date: formatYmdLocal(preferredDate),
          preferred_time: preferredTimeSlot,
          notes: notes.trim() || undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        attachment ?? undefined
      );
      showDialog({
        title: 'تم',
        message: 'أُرسل الطلب بنجاح',
        buttons: [
          {
            text: 'حسناً',
            onPress: () =>
              navigation.replace('CustomerRequestDetail', { requestId: request.request_id }),
          },
        ],
      });
    } catch (e) {
      showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل الإرسال' });
    } finally {
      setSubmitting(false);
    }
  }

  const minSelectableDate = useMemo(() => startOfToday(), []);

  async function onUseMyLocation() {
    setLocationLoading(true);
    setLocationStatus('capturing');
    try {
      const pos = await getCurrentCoords();
      setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      setMapLayoutKey((k) => k + 1);
      setLocationStatus('ok');
    } catch (e) {
      if (isLocationError(e) && e.code === 'permission_denied') {
        setLocationStatus('denied');
      } else {
        setLocationStatus('error');
      }
    } finally {
      setLocationLoading(false);
    }
  }

  function handlePinChange(next: ServiceMapCoords) {
    setCoords(next);
    setLocationStatus('ok');
  }

  function locationStatusMessage(): string | null {
    switch (locationStatus) {
      case 'capturing':
        return t('customerCreateRequest.locationCapturing');
      case 'ok':
        return coords ? t('customerCreateRequest.locationOk') : null;
      case 'denied':
        return t('customerCreateRequest.locationDenied');
      case 'error':
        return t('customerCreateRequest.locationError');
      default:
        return null;
    }
  }

  async function pickAttachment() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showDialog({
        title: 'تنبيه',
        message: 'يُرجى السماح بالوصول إلى المعرض لإرفاق صورة أو فيديو.',
      });
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 0.85,
      videoMaxDuration: 180,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const isVideo = asset.type === 'video';
    const name =
      asset.fileName ?? (isVideo ? `attach_${Date.now()}.mp4` : `attach_${Date.now()}.jpg`);
    const mimeType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    setAttachment({ uri: asset.uri, name, mimeType });
  }

  function openDatePicker() {
    const base = preferredDate ?? minSelectableDate;
    setIosDraftDate(base);
    if (Platform.OS === 'android') {
      setShowAndroidDatePicker(true);
    } else {
      setIosDatePickerOpen(true);
    }
  }

  function onAndroidDateChange(event: DateTimePickerEvent, date?: Date) {
    setShowAndroidDatePicker(false);
    if (event.type === 'set' && date) setPreferredDate(date);
  }

  if (specLoading) {
    return (
      <View style={[commonStyles.screenBg, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  return (
    <KeyboardSafeScrollView
      style={commonStyles.screenBg}
      contentContainerStyle={[commonStyles.scrollContent, { paddingBottom: 120 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadSpecs();
          }}
        />
      }
    >
      <Text style={commonStyles.subtitle}>نوع الخدمة</Text>
      <View style={styles.specList}>
        {specs.map((s) => (
          <Pressable
            key={s.spec_id}
            style={[styles.specRow, selectedSpecId === s.spec_id && styles.specRowOn]}
            onPress={() => setSelectedSpecId(s.spec_id)}
          >
            <Text style={styles.specText}>{s.name_ar}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={commonStyles.subtitle}>وصف المشكلة (20+ حرف)</Text>
      <TextInput
        style={[commonStyles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="صف المشكلة..."
        placeholderTextColor="#94a3b8"
        multiline
        textAlignVertical="top"
        textAlign="right"
      />
      <TextInput
        style={commonStyles.input}
        value={city}
        onChangeText={setCity}
        placeholder="المدينة"
        placeholderTextColor="#94a3b8"
        textAlign="right"
      />
      <TextInput
        style={commonStyles.input}
        value={district}
        onChangeText={setDistrict}
        placeholder="الحي"
        placeholderTextColor="#94a3b8"
        textAlign="right"
      />
      <TextInput
        style={commonStyles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="العنوان التفصيلي"
        placeholderTextColor="#94a3b8"
        textAlign="right"
      />
      <Text style={[commonStyles.subtitle, styles.mapSectionTitle]}>
        {t('customerCreateRequest.mapSectionTitle')}
      </Text>
      <ServiceLocationMapPicker
        key={mapLayoutKey}
        value={coords}
        onChange={handlePinChange}
      />
      <Pressable
        style={[commonStyles.secondaryBtn, styles.locationBtn]}
        onPress={() => void onUseMyLocation()}
        disabled={locationLoading || submitting}
        accessibilityRole="button"
        accessibilityLabel={t('customerCreateRequest.useMyLocation')}
      >
        {locationLoading ? (
          <ActivityIndicator color={colors.primaryBlue} />
        ) : (
          <Text style={commonStyles.secondaryBtnText}>{t('customerCreateRequest.useMyLocation')}</Text>
        )}
      </Pressable>
      {locationStatusMessage() ? (
        <Text
          style={[
            styles.locationStatus,
            locationStatus === 'ok' && styles.locationStatusOk,
            (locationStatus === 'denied' || locationStatus === 'error') && styles.locationStatusErr,
          ]}
        >
          {locationStatusMessage()}
        </Text>
      ) : null}
      <Text style={commonStyles.subtitle}>التاريخ المفضل</Text>
      <Pressable
        style={[commonStyles.input, styles.dateField]}
        onPress={openDatePicker}
        accessibilityRole="button"
        accessibilityLabel="اختيار التاريخ المفضل"
      >
        <Text style={[styles.dateFieldText, !preferredDate && styles.dateFieldPlaceholder]}>
          {preferredDate ? formatYmdLocal(preferredDate) : 'اختر التاريخ'}
        </Text>
      </Pressable>
      {showAndroidDatePicker ? (
        <DateTimePicker
          value={preferredDate ?? minSelectableDate}
          mode="date"
          display="default"
          minimumDate={minSelectableDate}
          onChange={onAndroidDateChange}
        />
      ) : null}

      <Modal visible={iosDatePickerOpen} transparent animationType="fade" onRequestClose={() => setIosDatePickerOpen(false)}>
        <View style={styles.iosModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setIosDatePickerOpen(false)} />
          <View style={styles.iosModalCard}>
            <DateTimePicker
              value={iosDraftDate}
              mode="date"
              display="spinner"
              minimumDate={minSelectableDate}
              locale="ar"
              onChange={(_, d) => {
                if (d) setIosDraftDate(d);
              }}
            />
            <View style={styles.iosModalActions}>
              <Pressable
                style={styles.iosModalBtnGhost}
                onPress={() => setIosDatePickerOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.iosModalBtnGhostText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={styles.iosModalBtnPrimary}
                onPress={() => {
                  setPreferredDate(iosDraftDate);
                  setIosDatePickerOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.iosModalBtnPrimaryText}>تم</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={commonStyles.subtitle}>الوقت المفضل</Text>
      <View style={styles.timeSlotList}>
        {TIME_SLOTS.map((slot) => (
          <Pressable
            key={slot.value}
            style={[styles.timeSlotRow, preferredTimeSlot === slot.value && styles.timeSlotRowOn]}
            onPress={() => setPreferredTimeSlot(slot.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: preferredTimeSlot === slot.value }}
          >
            <Text style={styles.timeSlotText}>{slot.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={[commonStyles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="ملاحظات (اختياري)"
        placeholderTextColor="#94a3b8"
        multiline
        textAlignVertical="top"
        textAlign="right"
      />

      <Text style={commonStyles.subtitle}>صورة أو فيديو (اختياري)</Text>
      <Pressable
        style={[commonStyles.secondaryBtn, styles.attachBtn]}
        onPress={() => void pickAttachment()}
        accessibilityRole="button"
        accessibilityLabel="اختيار صورة أو فيديو"
      >
        <Text style={commonStyles.secondaryBtnText}>
          {attachment ? 'تغيير المرفق' : 'إرفاق من المعرض'}
        </Text>
      </Pressable>
      {attachment ? (
        <View style={styles.previewWrap}>
          {attachment.mimeType.startsWith('video') ? (
            <Text style={styles.previewHint}>تم اختيار فيديو — سيُعرض بعد الإرسال</Text>
          ) : (
            <Image source={{ uri: attachment.uri }} style={styles.previewImg} resizeMode="cover" />
          )}
          <Pressable onPress={() => setAttachment(null)} accessibilityRole="button">
            <Text style={styles.removeAttach}>إزالة المرفق</Text>
          </Pressable>
        </View>
      ) : null}

      <PrimaryGradientPressable onPress={() => void onSubmit()} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={primaryGradientLabel.text}>إنشاء الطلب</Text>
        )}
      </PrimaryGradientPressable>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', flex: 1, backgroundColor: 'transparent' },
  specList: { marginBottom: 12 },
  specRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    marginBottom: 8,
    backgroundColor: colors.bgSurface,
  },
  specRowOn: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  specText: {
    textAlign: 'start' as any,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 100 },
  disabled: { opacity: 0.7 },
  dateField: {
    justifyContent: 'center',
    minHeight: 48,
  },
  dateFieldText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  dateFieldPlaceholder: {
    color: colors.textMuted,
  },
  timeSlotList: { marginBottom: 12 },
  timeSlotRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    marginBottom: 8,
    backgroundColor: colors.bgSurface,
  },
  timeSlotRowOn: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  timeSlotText: {
    textAlign: 'start' as any,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  iosModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  iosModalCard: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 24,
  },
  iosModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  iosModalBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primaryBlue,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  iosModalBtnPrimaryText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  iosModalBtnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  iosModalBtnGhostText: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  attachBtn: { marginBottom: 8 },
  previewWrap: { marginBottom: 16 },
  previewImg: {
    width: '100%',
    height: 160,
    borderRadius: radii.md,
    backgroundColor: colors.borderSoft,
    marginBottom: 8,
  },
  previewHint: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  removeAttach: {
    textAlign: 'start' as any,
    color: colors.primaryBlue,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  mapSectionTitle: { marginTop: 4 },
  locationBtn: { marginTop: 12, marginBottom: 8 },
  locationStatus: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  locationStatusOk: {
    color: '#15803d',
  },
  locationStatusErr: {
    color: '#b91c1c',
  },
});
