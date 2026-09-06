import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ progress, height = 4, showLabel = false, label }: ProgressBarProps) {
  return (
    <View>
      <View style={[styles.bar, { height }]}>
        <View style={[styles.fill, { width: `${progress}%`, height }]} />
      </View>
      {showLabel && (
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: progress >= 100 ? theme.status.completed : theme.accent.warm }]} />
          <Text style={styles.label}>{label ?? `${progress}%`}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.bg.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: theme.accent.warm,
    borderRadius: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: theme.text.secondary,
    fontSize: 12,
  },
});
