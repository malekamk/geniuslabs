import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useNetwork } from '@/context/network-context';

const OFFLINE_BG = '#DC2626';
const BACK_ONLINE_BG = '#0bd648';
const BANNER_CONTENT_HEIGHT = 32;

/**
 * App-wide connectivity banner — extends into the status bar (colored,
 * instead of fighting it) and pushes screen content down when offline
 * (rather than overlaying it, so screen titles/headers stay visible), and
 * briefly flashes a green "Back online" confirmation before hiding once
 * reconnected.
 */
export function OfflineBanner() {
  const { bannerPhase: phase } = useNetwork();
  const insets = useSafeAreaInsets();
  const height = useSharedValue(0);
  const expandedHeight = insets.top + BANNER_CONTENT_HEIGHT;

  const visible = phase !== 'hidden';

  useEffect(() => {
    height.value = withTiming(visible ? expandedHeight : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, expandedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  if (phase === 'hidden') return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: phase === 'offline' ? OFFLINE_BG : BACK_ONLINE_BG, paddingTop: insets.top },
        animatedStyle,
      ]}>
      <Ionicons
        name={phase === 'offline' ? 'cloud-offline-outline' : 'checkmark-circle-outline'}
        size={15}
        color="#fff"
      />
      <ThemedText style={styles.text}>
        {phase === 'offline' ? 'No Internet Connection' : 'Back online'}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
