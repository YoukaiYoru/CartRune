import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme';

interface AvatarProps {
  username?: string | null;
  size?: number;
}

export function Avatar({ username, size = 36 }: AvatarProps) {
  const isLarge = size >= 80;
  const bgColor = isLarge ? theme.accent.warm : theme.bg.elevated;
  const fontSize = isLarge ? 30 : 13;
  const ringSize = size + 6;

  return (
    <View style={styles.wrapper}>
      {isLarge && (
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
          <View style={[styles.ringInner, { width: ringSize - 4, height: ringSize - 4, borderRadius: (ringSize - 4) / 2 }]} />
        </View>
      )}
      <View style={[
        styles.avatar,
        { width: size, height: size, borderRadius: isLarge ? 12 : size / 2, backgroundColor: bgColor },
      ]}>
        <Text style={[styles.text, { fontSize }]}>
          {username?.[0]?.toUpperCase() || 'U'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.accent.primary,
    opacity: 0.4,
  },
  ringInner: {
    position: 'absolute',
    top: 2,
    left: 2,
    borderWidth: 1,
    borderColor: theme.accent.warm,
    opacity: 0.25,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: theme.text.primary, fontWeight: '700' },
});
