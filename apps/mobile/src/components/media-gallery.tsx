import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { ScreenScraperDetail } from '@/services/types';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';

interface Props {
  detail: ScreenScraperDetail;
  isLoading?: boolean;
}

function VideoCard({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });

  return (
    <View style={styles.videoCard}>
      {playing ? (
        <VideoView
          player={player}
          style={styles.videoFrame}
          contentFit="contain"
          nativeControls
        />
      ) : (
        <Pressable style={styles.videoPoster} onPress={() => setPlaying(true)}>
          <Text style={styles.videoPlay}>▶</Text>
          <Text style={styles.videoHint}>Tap to play</Text>
        </Pressable>
      )}
    </View>
  );
}

export function MediaGallery({ detail, isLoading }: Props) {
  const media = detail?.media ?? [];
  const images = media.filter((m) => m.kind !== 'video');
  const videos = media.filter((m) => m.kind === 'video');

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={theme.accent.warm} />
        <Text style={styles.loadingText}>Fetching ScreenScraper media...</Text>
      </View>
    );
  }

  if (!media.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Media</Text>
      <Text style={styles.subtitle}>From the ScreenScraper database</Text>

      {images.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageRow}
        >
          {images.map((m, i) => (
            <Image
              key={`${m.key}-${i}`}
              source={{ uri: resolveApiUrl(m.url) }}
              style={styles.thumb}
              contentFit="contain"
            />
          ))}
        </ScrollView>
      ) : null}

      {videos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.videoRow}
        >
          {videos.map((m, i) => (
            <VideoCard key={`${m.key}-${i}`} url={resolveApiUrl(m.url) ?? m.url} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingVertical: 4,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  loadingText: { color: theme.text.muted, fontSize: 13, marginLeft: 10 },
  title: { color: theme.text.primary, fontSize: 15, fontWeight: '700' },
  subtitle: { color: theme.text.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  imageRow: { paddingRight: 16, alignItems: 'center' },
  videoRow: { paddingRight: 16 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: theme.bg.surface,
  },
  videoCard: {
    width: 200,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: theme.bg.deep,
  },
  videoPoster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlay: { color: theme.text.primary, fontSize: 34 },
  videoHint: { color: theme.text.muted, fontSize: 11, marginTop: 6 },
  videoFrame: { width: 200, height: 120 },
});
