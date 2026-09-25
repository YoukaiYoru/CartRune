import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/theme';

/** A lightweight depth layer that works in Expo Go without a GL dependency. */
export function ImmersiveBackdrop() {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const drift = useSharedValue(0);
  const pulse = useSharedValue(0.72);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0;
      pulse.value = 0.72;
      return;
    }
    drift.value = withRepeat(
      withSequence(withTiming(1, { duration: 5200 }), withTiming(0, { duration: 5200 })),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 2600 }), withTiming(0.68, { duration: 2600 })),
      -1,
      true
    );
  }, [drift, pulse, reduceMotion]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 24 },
      { translateY: drift.value * -18 },
      { rotate: `${drift.value * 8 - 4}deg` },
    ],
    opacity: pulse.value,
  }));

  return (
    <View pointerEvents="none" style={styles.fill}>
      <Animated.View
        style={[
          styles.orb,
          styles.orbCyan,
          { left: width * 0.56, top: height * 0.06 },
          orbStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbLime,
          { left: width * -0.18, top: height * 0.42 },
          orbStyle,
        ]}
      />
      <View style={styles.vignette} />
      <View style={styles.grid}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View key={index} style={[styles.gridLine, { top: `${18 + index * 11}%` }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 210, height: 210, borderRadius: 120 },
  orbCyan: { backgroundColor: 'rgba(86, 182, 255, 0.13)', shadowColor: theme.accent.electric, shadowOpacity: 0.38, shadowRadius: 60 },
  orbLime: { backgroundColor: 'rgba(184, 255, 74, 0.08)', shadowColor: theme.accent.primary, shadowOpacity: 0.3, shadowRadius: 70 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  vignette: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3, 6, 13, 0.20)' },
  grid: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.22, transform: [{ perspective: 500 }, { rotateX: '62deg' }, { scale: 1.8 }, { translateY: 170 }] },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: theme.accent.electric },
});
