import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';

const PRIMARY = '#1565C0';

function Dot({ delay, color, size }: { delay: number; color: string; size: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + t.value * 0.7,
    transform: [{ scale: 0.55 + t.value * 0.45 }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

/** Three softly bouncing dots — the app's standard "something is loading" motif. */
export function LoadingDots({ size = 8, color = PRIMARY, style }: { size?: number; color?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      <Dot delay={0} color={color} size={size} />
      <Dot delay={130} color={color} size={size} />
      <Dot delay={260} color={color} size={size} />
    </View>
  );
}

/** Drop-in replacement for a "Loading…" text row — dots + label, inline. */
export function LoadingRow({
  label = 'Loading…',
  color = PRIMARY,
  textColor = '#9CA3AF',
  style,
}: {
  label?: string;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.rowWithText, style]}>
      <LoadingDots size={7} color={color} />
      <ThemedText style={[styles.text, { color: textColor }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rowWithText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  text: { fontSize: 13 },
});
