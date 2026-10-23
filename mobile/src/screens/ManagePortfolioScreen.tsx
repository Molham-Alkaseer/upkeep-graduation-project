import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  apiPortfolioCreate,
  apiPortfolioDelete,
  apiPortfolioList,
  apiPortfolioPatch,
  apiPortfolioReorder,
  portfolioMediaAbsoluteUrl,
  type PortfolioLimits,
  type PortfolioOwnerItem,
} from '../api';
import type { HomeStackParamList } from '../navigation/types';
import { commonStyles } from '../ui/commonStyles';
import { colors, fonts, radii } from '../ui/theme';
import { GradientActionButton } from '../ui/GradientActionButton';

type Props = NativeStackScreenProps<HomeStackParamList, 'ManagePortfolio'>;

export function ManagePortfolioScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<PortfolioLimits | null>(null);
  const [items, setItems] = useState<PortfolioOwnerItem[]>([]);

  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('');
  const [workDate, setWorkDate] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const { limits: lim, items: rows } = await apiPortfolioList();
      setLimits(lim);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('portfolio.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const maxMb = limits ? Math.max(1, Math.floor(limits.max_image_bytes / (1024 * 1024))) : 8;

  async function pickAndUpload() {
    if (!limits || items.length >= limits.max_items) {
      Alert.alert('', t('portfolio.limitReached'));
      return;
    }
    const cap = caption.trim();
    if (!cap) {
      Alert.alert('', t('portfolio.captionPlaceholder'));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('', t('errors.loadFailed'));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const uri = asset.uri;
    const name = uri.split('/').pop() || 'photo.jpg';
    const mime = asset.mimeType ?? 'image/jpeg';

    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('caption', cap);
      if (category.trim()) fd.append('category', category.trim());
      if (workDate.trim()) fd.append('work_date', workDate.trim());
      fd.append('file', { uri, name, type: mime } as unknown as Blob);
      const { limits: lim, item } = await apiPortfolioCreate(fd);
      setLimits(lim);
      setItems((prev) => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
      setCaption('');
      setCategory('');
      setWorkDate('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('portfolio.saveError'));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number) {
    Alert.alert('', t('portfolio.deleteConfirm'), [
      { text: t('dialog.button.cancel'), style: 'cancel' },
      {
        text: t('portfolio.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const { limits: lim } = await apiPortfolioDelete(id);
              setLimits(lim);
              setItems((prev) => prev.filter((x) => x.portfolio_item_id !== id));
            } catch (e) {
              Alert.alert('', e instanceof Error ? e.message : t('portfolio.saveError'));
            }
          })();
        },
      },
    ]);
  }

  async function move(itemId: number, dir: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order || a.portfolio_item_id - b.portfolio_item_id);
    const idx = ordered.findIndex((x) => x.portfolio_item_id === itemId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[idx], swapped[j]] = [swapped[j], swapped[idx]];
    const ids = swapped.map((x) => x.portfolio_item_id);
    try {
      const { limits: lim, items: next } = await apiPortfolioReorder(ids);
      setLimits(lim);
      setItems(next);
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : t('portfolio.saveError'));
    }
  }

  async function saveMeta(it: PortfolioOwnerItem, nextCaption: string, nextCat: string, nextDate: string) {
    try {
      const { limits: lim, item } = await apiPortfolioPatch(it.portfolio_item_id, {
        caption: nextCaption.trim(),
        category: nextCat.trim() || null,
        work_date: nextDate.trim() || null,
      });
      setLimits(lim);
      setItems((prev) => prev.map((x) => (x.portfolio_item_id === item.portfolio_item_id ? item : x)));
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : t('portfolio.saveError'));
    }
  }

  return (
    <ScrollView
      style={commonStyles.screenBg}
      contentContainerStyle={[commonStyles.scrollContent, styles.scrollPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>{t('portfolio.manageTitle')}</Text>
      <Text style={styles.sub}>{t('portfolio.manageSubtitle')}</Text>
      {limits ? (
        <Text style={styles.hint}>
          {t('portfolio.hintLimits', { maxItems: limits.max_items, maxMb })}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primaryBlue} />
      ) : null}
      {error ? <Text style={commonStyles.error}>{error}</Text> : null}

      <View style={commonStyles.card}>
        <Text style={styles.sectionLabel}>{t('portfolio.addPhoto')}</Text>
        <Text style={styles.fieldLabel}>{t('portfolio.captionLabel')}</Text>
        <TextInput
          style={styles.input}
          value={caption}
          onChangeText={setCaption}
          placeholder={t('portfolio.captionPlaceholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={limits?.caption_max_len ?? 280}
          editable={!uploading && (!limits || items.length < limits.max_items)}
        />
        <Text style={styles.fieldLabel}>{t('portfolio.categoryLabel')}</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholderTextColor={colors.textMuted}
          maxLength={limits?.category_max_len ?? 60}
          editable={!uploading && (!limits || items.length < limits.max_items)}
        />
        <Text style={styles.fieldLabel}>{t('portfolio.workDateLabel')}</Text>
        <TextInput
          style={styles.input}
          value={workDate}
          onChangeText={setWorkDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          editable={!uploading && (!limits || items.length < limits.max_items)}
        />
        <GradientActionButton
          label={t('portfolio.pickImage')}
          variant="brand"
          loading={uploading}
          onPress={() => void pickAndUpload()}
          disabled={uploading || (limits != null && items.length >= limits.max_items)}
          style={styles.addBtn}
        />
      </View>

      {!loading && items.length === 0 ? (
        <Text style={styles.empty}>{t('portfolio.emptyOwner')}</Text>
      ) : null}

      {[...items]
        .sort((a, b) => a.sort_order - b.sort_order || a.portfolio_item_id - b.portfolio_item_id)
        .map((it) => (
          <PortfolioRow
            key={it.portfolio_item_id}
            item={it}
            limits={limits}
            onMove={(dir) => void move(it.portfolio_item_id, dir)}
            onDelete={() => void remove(it.portfolio_item_id)}
            onSaveMeta={(capV, catV, dateV) => void saveMeta(it, capV, catV, dateV)}
          />
        ))}
    </ScrollView>
  );
}

function PortfolioRow({
  item,
  limits,
  onMove,
  onDelete,
  onSaveMeta,
}: {
  item: PortfolioOwnerItem;
  limits: PortfolioLimits | null;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onSaveMeta: (c: string, cat: string, d: string) => void;
}) {
  const { t } = useTranslation();
  const [cap, setCap] = useState(item.caption);
  const [cat, setCat] = useState(item.category ?? '');
  const [dt, setDt] = useState(item.work_date ?? '');
  const thumb = portfolioMediaAbsoluteUrl(item.thumb_url_path);

  return (
    <View style={styles.rowCard}>
      <Image source={{ uri: thumb }} style={styles.thumb} accessibilityIgnoresInvertColors />
      <TextInput
        style={styles.input}
        value={cap}
        onChangeText={setCap}
        maxLength={limits?.caption_max_len ?? 280}
      />
      <TextInput
        style={styles.input}
        value={cat}
        onChangeText={setCat}
        placeholder={t('portfolio.categoryLabel')}
        placeholderTextColor={colors.textMuted}
        maxLength={limits?.category_max_len ?? 60}
      />
      <TextInput
        style={styles.input}
        value={dt}
        onChangeText={setDt}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.rowActions}>
        <Pressable style={styles.iconAct} onPress={() => onMove(-1)} accessibilityLabel={t('portfolio.moveUp')}>
          <Ionicons name="arrow-up" size={22} color={colors.primaryBlue} />
        </Pressable>
        <Pressable style={styles.iconAct} onPress={() => onMove(1)} accessibilityLabel={t('portfolio.moveDown')}>
          <Ionicons name="arrow-down" size={22} color={colors.primaryBlue} />
        </Pressable>
        <Pressable
          style={styles.saveBtn}
          onPress={() => onSaveMeta(cap, cat, dt)}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>{t('portfolio.saveItem')}</Text>
        </Pressable>
        <Pressable style={styles.iconAct} onPress={onDelete} accessibilityLabel={t('portfolio.delete')}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingBottom: 48 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sub: { color: colors.textSecondary, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  loader: { marginVertical: 16 },
  sectionLabel: { fontFamily: fonts.bold, marginBottom: 8, color: colors.textPrimary },
  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
  },
  addBtn: { marginTop: 8 },
  empty: { textAlign: 'center', color: colors.textMuted, marginVertical: 16 },
  rowCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  thumb: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    marginBottom: 8,
    backgroundColor: colors.borderSoft,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  iconAct: { padding: 8 },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryBlue,
    borderRadius: radii.md,
  },
  saveBtnText: { color: colors.bgSurface, fontFamily: fonts.bold },
});
