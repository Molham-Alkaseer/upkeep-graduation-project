import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PortfolioPublicItem } from '../api';
import { portfolioMediaAbsoluteUrl } from '../api';
import { colors } from '../ui/theme';

const WINDOW_WIDTH = Dimensions.get('window').width;
const IMAGE_H = Math.round(Dimensions.get('window').height * 0.62);

type Props = {
  visible: boolean;
  onClose: () => void;
  items: PortfolioPublicItem[];
  initialIndex: number;
  titleNext: string;
  titlePrev: string;
  titleClose: string;
};

export function PortfolioLightbox({
  visible,
  onClose,
  items,
  initialIndex,
  titleNext,
  titlePrev,
  titleClose,
}: Props) {
  const listRef = useRef<FlatList<PortfolioPublicItem>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible || items.length < 1) return;
    const i = Math.max(0, Math.min(items.length - 1, initialIndex));
    setIndex(i);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: i, animated: false });
    });
  }, [visible, initialIndex, items]);

  const scrollTo = useCallback((i: number, animated: boolean) => {
    if (items.length < 1) return;
    const next = Math.max(0, Math.min(items.length - 1, i));
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated });
  }, [items.length]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / WINDOW_WIDTH);
      setIndex(Math.max(0, Math.min(items.length - 1, i)));
    },
    [items.length]
  );

  const renderItem = useCallback(({ item }: ListRenderItemInfo<PortfolioPublicItem>) => {
    const uri = portfolioMediaAbsoluteUrl(item.media_url_path || item.thumb_url_path);
    return (
      <View style={styles.page}>
        <Image
          source={uri ? { uri } : undefined}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={item.caption || undefined}
        />
      </View>
    );
  }, []);

  const current = items[index];

  if (items.length < 1) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.toolbar}>
          <View style={styles.toolbarSpacer} />
          <Pressable
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={titleClose}
          >
            <Ionicons name="close" size={28} color={colors.bgSurface} />
          </Pressable>
        </View>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          keyExtractor={(it) => String(it.portfolio_item_id)}
          renderItem={renderItem}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_, i) => ({
            length: WINDOW_WIDTH,
            offset: WINDOW_WIDTH * i,
            index: i,
          })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={({ index: failIdx }) => {
            setTimeout(() => scrollTo(failIdx, false), 60);
          }}
        />
        {current ? (
          <View style={styles.captionBlock}>
            <Text style={styles.caption} accessibilityLiveRegion="polite">
              {current.caption}
            </Text>
            {[current.category, current.work_date].filter(Boolean).length > 0 ? (
              <Text style={styles.meta}>
                {[current.category, current.work_date].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.navRow}>
          <Pressable
            style={styles.navBtn}
            onPress={() => scrollTo(index - 1, true)}
            disabled={index <= 0}
            accessibilityRole="button"
            accessibilityLabel={titlePrev}
            accessibilityState={{ disabled: index <= 0 }}
          >
            <Ionicons name="chevron-back" size={24} color={index <= 0 ? '#555' : colors.bgSurface} />
            <Text style={[styles.navText, index <= 0 && styles.navTextDisabled]}>{titlePrev}</Text>
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => scrollTo(index + 1, true)}
            disabled={index >= items.length - 1}
            accessibilityRole="button"
            accessibilityLabel={titleNext}
            accessibilityState={{ disabled: index >= items.length - 1 }}
          >
            <Text style={[styles.navText, index >= items.length - 1 && styles.navTextDisabled]}>{titleNext}</Text>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={index >= items.length - 1 ? '#555' : colors.bgSurface}
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 48,
    paddingHorizontal: 8,
  },
  toolbarSpacer: { flex: 1 },
  iconBtn: { padding: 12 },
  page: { width: WINDOW_WIDTH, alignItems: 'center', justifyContent: 'center' },
  image: { width: WINDOW_WIDTH, height: IMAGE_H, backgroundColor: '#111' },
  captionBlock: { paddingHorizontal: 20, paddingBottom: 12 },
  caption: { color: colors.bgSurface, fontSize: 16, textAlign: 'center' },
  meta: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 4 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  navText: { color: colors.bgSurface, fontSize: 16 },
  navTextDisabled: { color: '#555' },
});
