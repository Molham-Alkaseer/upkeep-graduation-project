import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, StyleSheet, Text, View } from 'react-native';
import { requestAttachmentMediaUri } from '../api';
import { colors, fonts, radii } from './theme';

type Props = {
  attachment_url_path?: string | null;
  attachment_kind?: string | null;
};

function AttachedVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView style={styles.video} player={player} nativeControls contentFit="contain" accessibilityLabel="فيديو الطلب" />
  );
}

export function RequestAttachmentMedia({ attachment_url_path, attachment_kind }: Props) {
  const uri = requestAttachmentMediaUri({ attachment_url_path: attachment_url_path ?? null });
  if (!uri || !attachment_kind) {
    return null;
  }
  if (attachment_kind === 'image') {
    return (
      <View style={styles.block}>
        <Text style={styles.caption}>صورة مرفقة</Text>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel="صورة الطلب" />
      </View>
    );
  }
  if (attachment_kind === 'video') {
    return (
      <View style={styles.block}>
        <Text style={styles.caption}>فيديو مرفق</Text>
        <AttachedVideoPlayer uri={uri} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  block: { marginTop: 12 },
  caption: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.borderSoft,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    backgroundColor: '#000',
  },
});
