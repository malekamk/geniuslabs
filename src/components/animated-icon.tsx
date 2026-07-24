import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const BG = '#FFFFFF'; // matches app.json's expo-splash-screen backgroundColor exactly

export function BrandedLoadingScreen() {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    // Entrance: fade + scale up — the "logo expanding" beat
    opacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    glowOpacity.value = withDelay(150, withTiming(0.6, { duration: 700, easing: Easing.out(Easing.quad) }));

    // If loading runs past ~1s, settle into a slow, subtle breathing pulse
    // instead of sitting frozen — keeps a slow cold start from reading as stuck.
    breathe.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value + breathe.value * 0.04 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * (0.85 + breathe.value * 0.15),
    transform: [{ scale: 1 + breathe.value * 0.06 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('@/assets/images/logo-glow.png')}
        style={[styles.glow, glowStyle]}
        resizeMode="contain"
      />
      <Animated.Image
        source={require('@/assets/images/geniuslabs-logo.png')}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 260, height: 260 },
  logo: { width: 140, height: 122 },
});
